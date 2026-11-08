#ifndef PENDULUM_BOARD_H
#define PENDULUM_BOARD_H
#include "stm32f7xx_hal.h"
#include <stdbool.h>
#include <stddef.h>

#define BOARD_LED1 GPIO_PIN_0
#define BOARD_LED2 GPIO_PIN_7
#define BOARD_LED3 GPIO_PIN_14
#define BOARD_LEDS_ALL (BOARD_LED1 | BOARD_LED2 | BOARD_LED3)

void board_init(void);
void board_leds_set(uint16_t leds);
void board_serial_init(void);
void board_serial_poll(void);
bool board_serial_read(uint8_t *byte);
bool board_serial_write(const uint8_t *bytes, size_t length, bool telemetry);
bool board_serial_overflow(void);
_Noreturn void Error_Handler(void);
#endif
