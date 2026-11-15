#define _POSIX_C_SOURCE 200809L
#define _DEFAULT_SOURCE
#define _DARWIN_C_SOURCE
#include "device.h"
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <termios.h>
#include <time.h>
#include <unistd.h>
#ifdef __APPLE__
#include <util.h>
#else
#include <pty.h>
#endif

static device_t device;
static volatile sig_atomic_t stopping;
static int input_fd = STDIN_FILENO, output_fd = STDOUT_FILENO;
static uint8_t tx[4096];
static size_t tx_head, tx_tail;
static void stop(int sig)
{
    (void)sig;
    stopping = 1;
}
static bool nonblocking(int fd)
{
    int flags = fcntl(fd, F_GETFL);
    return flags >= 0 && fcntl(fd, F_SETFL, flags | O_NONBLOCK) == 0;
}
static bool output(void *ctx, const uint8_t *bytes, size_t n, bool telemetry)
{
    (void)ctx;
    size_t free_bytes = (tx_tail + sizeof(tx) - tx_head - 1) % sizeof(tx);
    /* Like STM32 TX, admit complete frames and reserve response capacity. A
     * missing/slow serial reader may drop telemetry, never block the clock. */
    if (n + (telemetry ? 512U : 0U) > free_bytes)
        return false;
    for (size_t i = 0; i < n; ++i)
    {
        tx[tx_head] = bytes[i];
        tx_head = (tx_head + 1) % sizeof(tx);
    }
    return true;
}
static bool drain_output(void)
{
    if (tx_head == tx_tail)
        return true;
    size_t length = tx_head > tx_tail ? tx_head - tx_tail : sizeof(tx) - tx_tail;
    ssize_t n = write(output_fd, tx + tx_tail, length);
    if (n > 0)
        tx_tail = (tx_tail + (size_t)n) % sizeof(tx);
    return n >= 0 || errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR;
}
static uint64_t clock_us(void)
{
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (uint64_t)t.tv_sec * 1000000U + (uint64_t)t.tv_nsec / 1000U;
}
int main(int argc, char **argv)
{
    bool pty = argc == 2 && strcmp(argv[1], "--pty") == 0;
    if (argc != 1 && !pty)
    {
        fprintf(stderr, "Usage: pendulum-sim [--pty]\n");
        return argc == 2 && strcmp(argv[1], "--help") == 0 ? 0 : 2;
    }
    int replica = -1;
    if (pty)
    {
        int primary;
        if (openpty(&primary, &replica, NULL, NULL, NULL) < 0)
        {
            perror("openpty");
            return 1;
        }
        struct termios attributes;
        if (tcgetattr(replica, &attributes) < 0)
        {
            perror("tcgetattr");
            return 1;
        }
        cfmakeraw(&attributes);
        if (tcsetattr(replica, TCSANOW, &attributes) < 0)
        {
            perror("tcsetattr");
            return 1;
        }
        const char *path = ttyname(replica);
        if (!path)
        {
            perror("ttyname");
            return 1;
        }
        input_fd = output_fd = primary;
        if (!nonblocking(primary) || !nonblocking(STDIN_FILENO))
        {
            perror("fcntl");
            return 1;
        }
        /* stdout is a bounded readiness message only in PTY mode. Protocol
         * bytes use the primary FD; terminal text can never corrupt frames.
         * Keep the replica open so opening/closing SerialPort does not destroy
         * the PTY. The MCU command lease still expires with no client. */
        printf("{\"type\":\"serial_ready\",\"path\":\"%s\"}\n", path);
        fflush(stdout);
    }
    else if (!nonblocking(input_fd) || !nonblocking(output_fd))
    {
        perror("fcntl");
        return 1;
    }
    signal(SIGINT, stop);
    signal(SIGTERM, stop);
    signal(SIGPIPE, SIG_IGN);
    device_init(&device, output, NULL);
    uint64_t start = clock_us();
    int result = 0;
    while (!stopping)
    {
        if (pty)
        {
            /* stdin is the owning server's lifeline, not the wire transport.
             * EOF also cleans up after a hard parent crash, without a registry. */
            uint8_t control[64];
            ssize_t alive = read(STDIN_FILENO, control, sizeof(control));
            if (alive == 0)
                break;
            if (alive < 0 && errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR)
            {
                perror("lifeline");
                result = 1;
                break;
            }
        }
        /* Host scheduling pauses do not represent missed MCU deadlines. Advance
         * the virtual device in bounded wall-clock slices: this preserves lease
         * expiry and simulated elapsed time without raising a hardware overrun. */
        uint64_t now = clock_us() - start;
        while (now - device.last_tick > 32000)
            device_tick(&device, device.last_tick + 32000);
        device_tick(&device, now);
        if (!drain_output())
        {
            perror("write");
            result = 1;
            break;
        }
        uint8_t bytes[512];
        ssize_t n = read(input_fd, bytes, sizeof(bytes));
        if (n == 0)
            break;
        if (n > 0)
            for (ssize_t i = 0; i < n; ++i)
                device_receive(&device, bytes[i]);
        else if (errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR)
        {
            perror("read");
            result = 1;
            break;
        }
        struct timespec delay = {.tv_sec = 0, .tv_nsec = 500000};
        nanosleep(&delay, NULL);
    }
    if (replica >= 0)
    {
        close(input_fd);
        close(replica);
    }
    return result;
}
