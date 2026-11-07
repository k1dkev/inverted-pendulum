#include "board.h"

void board_init(void)
{
    /* Reset clock is HSI, 16 MHz. No external oscillator or PLL required. */
    if (HAL_Init() != HAL_OK) {
        Error_Handler();
    }

    __HAL_RCC_GPIOB_CLK_ENABLE();
    board_leds_set(0U);
    GPIO_InitTypeDef led = {0};
    led.Pin = BOARD_LEDS_ALL;
    led.Mode = GPIO_MODE_OUTPUT_PP;
    led.Pull = GPIO_NOPULL;
    led.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOB, &led);
}

void board_leds_set(uint16_t leds)
{
    /* Set active-high LEDs and clear the others in one atomic GPIO write. */
    const uint32_t on = leds & BOARD_LEDS_ALL;
    const uint32_t off = BOARD_LEDS_ALL & ~on;
    GPIOB->BSRR = on | (off << 16U);
}

void SysTick_Handler(void)
{
    HAL_IncTick();
}

_Noreturn void Error_Handler(void)
{
    __disable_irq();
    for (;;) {
        /* Halt here for inspection with a debugger. */
    }
}
