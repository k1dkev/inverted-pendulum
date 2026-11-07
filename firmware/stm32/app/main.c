#include "board.h"

int main(void)
{
    board_init();
    const uint16_t sequence[] = {
        BOARD_LED1, BOARD_LED2, BOARD_LED3, BOARD_LEDS_ALL
    };
    for (;;) {
        for (unsigned int step = 0U; step < sizeof(sequence) / sizeof(sequence[0]); ++step) {
            board_leds_set(sequence[step]);
            HAL_Delay(500U);
        }
    }
}
