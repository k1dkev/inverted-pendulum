#include "board.h"
#include "device.h"

static device_t device;
static bool send_serial(void *context, const uint8_t *bytes, size_t length, bool telemetry)
{
    (void)context;
    return board_serial_write(bytes, length, telemetry);
}

int main(void)
{
    board_init();
    board_serial_init();
    device_init(&device, send_serial, NULL);
    uint32_t previous_ms = HAL_GetTick();
    uint64_t time_us = 0;
    for (;;)
    {
        uint32_t now_ms = HAL_GetTick();
        time_us += (uint64_t)(uint32_t)(now_ms - previous_ms) * 1000U;
        previous_ms = now_ms;
        device_tick(&device, time_us);
        if (board_serial_overflow())
            device_rx_overflow(&device);
        uint8_t byte;
        for (unsigned i = 0; i < 64 && board_serial_read(&byte); ++i)
            device_receive(&device, byte);
        board_serial_poll();
        /* LD1 heartbeat, LD2 session established, LD3 fault. Motor pins remain
         * untouched: this image is simulation-only, with no physical actuation. */
        board_leds_set(((now_ms / 500U) % 2U ? BOARD_LED1 : 0U) |
                       (device.session ? BOARD_LED2 : 0U) | (device.faults ? BOARD_LED3 : 0U));
    }
}
