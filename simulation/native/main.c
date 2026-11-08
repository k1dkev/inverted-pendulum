#define _POSIX_C_SOURCE 200809L
#include "device.h"
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <time.h>
#include <unistd.h>
static device_t device;
static bool output(void *ctx, const uint8_t *bytes, size_t n, bool telemetry)
{
    (void)ctx;
    (void)telemetry;
    /* The native peer is a test harness. STM32 uses bounded interrupt TX. */
    return fwrite(bytes, 1, n, stdout) == n && fflush(stdout) == 0;
}
static uint64_t clock_us(void)
{
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (uint64_t)t.tv_sec * 1000000U + (uint64_t)t.tv_nsec / 1000U;
}
int main(void)
{
    device_init(&device, output, NULL);
    fcntl(STDIN_FILENO, F_SETFL, O_NONBLOCK);
    uint64_t start = clock_us();
    for (;;)
    {
        device_tick(&device, clock_us() - start);
        uint8_t bytes[512];
        ssize_t n = read(STDIN_FILENO, bytes, sizeof(bytes));
        if (n == 0)
            return 0;
        if (n > 0)
            for (ssize_t i = 0; i < n; ++i)
                device_receive(&device, bytes[i]);
        else if (errno != EAGAIN && errno != EINTR)
            return 1;
        struct timespec delay = {.tv_sec = 0, .tv_nsec = 500000};
        nanosleep(&delay, NULL);
    }
}
