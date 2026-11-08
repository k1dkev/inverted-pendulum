#ifndef PENDULUM_DEVICE_H
#define PENDULUM_DEVICE_H
#include "policy.h"
#include "protocol.h"
#include "simulation.h"
#include "telemetry.h"
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
    LOG_RECORD = 0x22,
    SIM_RESET = 0x30,
    SIM_STATE = 0x31,
    SIM_PAUSE = 0x32,
    SIM_SET_PARAMETERS = 0x33,
    SIM_GET_PARAMETERS = 0x34,
    SIM_PARAMETERS = 0x35,
    LIST_POLICIES = 0x40,
    POLICY_DESCRIPTOR = 0x41,
    GET_POLICY = 0x42,
    SELECT_POLICY = 0x43,
    START_POLICY = 0x44,
    POLICY_STATUS = 0x45,
    TELEMETRY_CATALOG = 0x50,
    TELEMETRY_DESCRIPTOR = 0x51,
    GET_SUBSCRIPTION = 0x52,
    SUBSCRIPTION = 0x53,
    SUBSCRIBE = 0x54,
    SELECTED_TELEMETRY = 0x55,
    GET_LOG_CONFIG = 0x60,
    LOG_CONFIG = 0x61,
    SET_LOG_LEVEL = 0x62
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
    simulation_parameters_t simulation_parameters;
    policy_t policy;
    device_send_fn send;
    void *context;
    uint64_t now, last_tick, last_sample, session, lease_deadline, last_rx;
    uint32_t tx_id, last_request, sample_seq, dropped, faults, config_revision;
    float acceleration_limit;
    uint64_t last_policy_status, last_selected_sample;
    uint32_t selected_mask, subscription_revision, selected_sample_seq;
    uint64_t log_window;
    uint32_t log_sequence, log_dropped;
    uint8_t log_level, log_count, logged_phase, logged_error;
    uint16_t logged_policy;
    uint16_t selected_hz;
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
