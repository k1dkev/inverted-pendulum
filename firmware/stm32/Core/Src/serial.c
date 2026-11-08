#include "board.h"

/* Interrupt-driven USART3, no DMA/DTCM/cache interaction. Single main-loop
 * producer/consumer plus UART ISR. Ring indices are aligned atomic words. */
static UART_HandleTypeDef uart;
static uint8_t rx_byte, rx[1024], tx[4096];
static volatile uint32_t rx_head, rx_tail, tx_head, tx_tail;
static volatile bool overflow, tx_busy;
static uint16_t tx_chunk;

void board_serial_init(void)
{
    __HAL_RCC_GPIOD_CLK_ENABLE();
    __HAL_RCC_USART3_CLK_ENABLE();
    GPIO_InitTypeDef pins = {0};
    pins.Pin = GPIO_PIN_8 | GPIO_PIN_9;
    pins.Mode = GPIO_MODE_AF_PP;
    pins.Pull = GPIO_PULLUP;
    pins.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
    pins.Alternate = GPIO_AF7_USART3;
    HAL_GPIO_Init(GPIOD, &pins);
    uart.Instance = USART3;
    uart.Init.BaudRate = 115200;
    uart.Init.WordLength = UART_WORDLENGTH_8B;
    uart.Init.StopBits = UART_STOPBITS_1;
    uart.Init.Parity = UART_PARITY_NONE;
    uart.Init.Mode = UART_MODE_TX_RX;
    uart.Init.HwFlowCtl = UART_HWCONTROL_NONE;
    uart.Init.OverSampling = UART_OVERSAMPLING_16;
    uart.Init.OneBitSampling = UART_ONE_BIT_SAMPLE_DISABLE;
    if (HAL_UART_Init(&uart) != HAL_OK)
        Error_Handler();
    HAL_NVIC_SetPriority(USART3_IRQn, 5, 0);
    HAL_NVIC_EnableIRQ(USART3_IRQn);
    if (HAL_UART_Receive_IT(&uart, &rx_byte, 1) != HAL_OK)
        Error_Handler();
}

void USART3_IRQHandler(void) { HAL_UART_IRQHandler(&uart); }
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *handle)
{
    if (handle != &uart)
        return;
    uint32_t next = (rx_head + 1U) % sizeof(rx);
    if (next == rx_tail)
        overflow = true;
    else
    {
        rx[rx_head] = rx_byte;
        __DMB();
        rx_head = next;
    }
    (void)HAL_UART_Receive_IT(&uart, &rx_byte, 1);
}
void HAL_UART_ErrorCallback(UART_HandleTypeDef *handle)
{
    if (handle != &uart)
        return;
    overflow = true;
    (void)HAL_UART_Receive_IT(&uart, &rx_byte, 1);
}
void HAL_UART_TxCpltCallback(UART_HandleTypeDef *handle)
{
    if (handle != &uart)
        return;
    tx_tail = (tx_tail + tx_chunk) % sizeof(tx);
    __DMB();
    tx_busy = false;
}
bool board_serial_overflow(void)
{
    uint32_t primask = __get_PRIMASK();
    __disable_irq();
    bool value = overflow;
    if (value)
    {
        rx_tail = rx_head;
        overflow = false;
    }
    __set_PRIMASK(primask);
    return value;
}
bool board_serial_read(uint8_t *byte)
{
    if (rx_head == rx_tail)
        return false;
    *byte = rx[rx_tail];
    __DMB();
    rx_tail = (rx_tail + 1U) % sizeof(rx);
    return true;
}
bool board_serial_write(const uint8_t *bytes, size_t length, bool telemetry)
{
    uint32_t free_bytes = (tx_tail + sizeof(tx) - tx_head - 1U) % sizeof(tx);
    if (length + (telemetry ? 512U : 0U) > free_bytes)
        return false;
    uint32_t head = tx_head;
    for (size_t i = 0; i < length; ++i)
    {
        tx[head] = bytes[i];
        head = (head + 1U) % sizeof(tx);
    }
    __DMB();
    tx_head = head;
    return true;
}
void board_serial_poll(void)
{
    if (tx_busy || tx_head == tx_tail)
        return;
    uint32_t head = tx_head;
    tx_chunk = (uint16_t)(head > tx_tail ? head - tx_tail : sizeof(tx) - tx_tail);
    tx_busy = true;
    if (HAL_UART_Transmit_IT(&uart, tx + tx_tail, tx_chunk) != HAL_OK)
    {
        tx_busy = false;
        overflow = true;
    }
}
