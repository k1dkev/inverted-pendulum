#ifndef PENDULUM_DEVICE_H
#define PENDULUM_DEVICE_H
#include "protocol.h"
#include "simulation.h"
enum
{
    IDLE = 1,
    ARMED = 2,
    RUNNING = 3,
    STOPPING = 4,
    FAULT = 5
};
enum
{
    HELLO = 1,
    HELLO_INFO = 2,
    GET_STATUS = 3,
    STATUS = 4,
    RESPONSE = 5,
    SET_TELEMETRY = 0x10,
    ARM = 0x11,
    VELOCITY = 0x12,
    STOP = 0x13,
    DISARM = 0x14,
    CLEAR_FAULT = 0x15,
    ZERO = 0x16,
    KEEPALIVE = 0x17,
    SET_ACCELERATION = 0x18,
    GET_CONFIG = 0x19,
    TELEMETRY = 0x20,
    EVENT = 0x21,
    SIM_RESET = 0x30,
    SIM_STATE = 0x31,
    SIM_PAUSE = 0x32
};
enum
{
    OK = 0,
    UNSUPPORTED = 1,
    BAD_PAYLOAD = 2,
    WRONG_STATE = 3,
    LIMIT_EXCEEDED = 4,
    FAULT_ACTIVE = 5,
    BAD_SESSION = 6,
    STALE_REQUEST = 7,
    ID_REUSE = 8,
    BUSY = 9,
    NOT_CONFIGURED = 10
};
typedef bool (*device_send_fn)(void *context, const uint8_t *bytes, size_t length, bool telemetry);
typedef struct
{
    uint32_t id, fingerprint;
    packet_t reply;
} request_cache_t;
typedef struct
{
    parser_t parser;
    simulation_t sim;
    device_send_fn send;
    void *context;
    uint64_t now, last_tick, last_sample, session, lease_deadline, last_rx;
    uint32_t tx_id, last_request, sample_seq, dropped, faults, config_revision;
    float acceleration_limit;
    uint16_t telemetry_hz;
    uint8_t state, cache_next;
    bool lease_active, manual_armed;
    request_cache_t cache[16];
} device_t;
void device_init(device_t *d, device_send_fn send, void *context);
void device_tick(device_t *d, uint64_t now_us);
void device_receive(device_t *d, uint8_t byte);
void device_rx_overflow(device_t *d);
#endif
