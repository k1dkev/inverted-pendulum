#include "device.h"
#include <assert.h>
#include <stdio.h>
static packet_t reply, selected;
static parser_t parser;
static unsigned baseline_count, selected_count, log_count;
static packet_t last_log;
static bool reject_logs;
static uint32_t next_id = 1;
static bool collect(void *ctx, const uint8_t *b, size_t n, bool telemetry)
{
    (void)ctx;
    (void)telemetry;
    packet_t p;
    bool accepted = true;
    for (size_t i = 0; i < n; ++i)
        if (proto_feed(&parser, b[i], &p))
        {
            if (p.type == LOG_RECORD)
            {
                ++log_count;
                last_log = p;
                if (reject_logs)
                    accepted = false;
            }
            else if (p.type == TELEMETRY)
                ++baseline_count;
            else if (p.type == SELECTED_TELEMETRY)
            {
                selected = p;
                ++selected_count;
            }
            else if (p.type != EVENT && p.type != LOG_RECORD &&
                     !(p.type == POLICY_STATUS && get_u32(p.payload) == 0))
                reply = p;
        }
    return accepted;
}
static void request(device_t *d, uint8_t type, const uint8_t *payload, uint16_t length)
{
    packet_t p = {0};
    p.type = type;
    p.id = next_id++;
    p.session = type == HELLO ? 0 : 123;
    p.length = length;
    for (unsigned i = 0; i < length; ++i)
        p.payload[i] = payload[i];
    uint8_t bytes[PROTO_MAX_FRAME];
    size_t n = proto_encode(&p, bytes);
    for (size_t i = 0; i < n; ++i)
        device_receive(d, bytes[i]);
}
static void ok(void) { assert(reply.type == RESPONSE && get_u16(reply.payload + 4) == OK); }
static void tick(device_t *d, uint64_t end)
{
    for (uint64_t t = d->now + 1000; t <= end; t += 1000)
        device_tick(d, t);
}
int main(void)
{
    static device_t d;
    device_init(&d, collect, 0);
    uint8_t b[24] = {0};
    put_u64(b, 123);
    request(&d, HELLO, b, 8);
    assert(reply.type == HELLO_INFO);
    for (unsigned i = 0; i < policy_count(); ++i)
    {
        put_u16(b, i);
        request(&d, LIST_POLICIES, b, 2);
        assert(reply.type == POLICY_DESCRIPTOR && get_u16(reply.payload + 8) == i);
    }
    for (unsigned i = 0; i < TELEMETRY_CHANNELS; ++i)
    {
        put_u16(b, i);
        request(&d, TELEMETRY_CATALOG, b, 2);
        assert(reply.type == TELEMETRY_DESCRIPTOR && get_u16(reply.payload + 8) == i);
        assert(reply.length == 16 + reply.payload[12] + reply.payload[13] + reply.payload[14]);
    }
    tick(&d, 100000);
    assert(baseline_count == 5 && selected_count == 0);
    uint32_t mask = (1U << 0) | (1U << 8);
    put_u32(b, mask);
    put_u16(b + 4, 10);
    put_u16(b + 6, 0);
    request(&d, SUBSCRIBE, b, 8);
    assert(reply.type == SUBSCRIPTION && get_u32(reply.payload + 8) == mask);
    uint32_t revision = get_u32(reply.payload + 12);
    request(&d, GET_SUBSCRIPTION, 0, 0);
    assert(get_u32(reply.payload + 12) == revision);
    tick(&d, 200000);
    assert(selected_count == 1 && baseline_count == 10 && selected.length == 36);
    assert(get_u32(selected.payload + 12) == mask && get_u32(selected.payload + 24) == 1);
    // Invalid subscription cannot mutate the active stream.
    put_u32(b, 1U << 31);
    request(&d, SUBSCRIBE, b, 8);
    assert(get_u16(reply.payload + 4) == BAD_PAYLOAD && d.selected_mask == mask);
    put_u16(b, 999);
    request(&d, SELECT_POLICY, b, 2);
    assert(get_u16(reply.payload + 4) == UNSUPPORTED && d.policy.id == POLICY_MANUAL);
    put_u16(b, POLICY_LEGACY);
    request(&d, SELECT_POLICY, b, 2);
    ok();
    request(&d, START_POLICY, 0, 0);
    assert(get_u16(reply.payload + 4) == WRONG_STATE);
    request(&d, ARM, 0, 0);
    ok();
    request(&d, START_POLICY, 0, 0);
    ok();
    assert(d.policy.running && d.sim.acceleration_controlled);
    put_f32(b, 100);
    request(&d, VELOCITY, b, 4);
    assert(get_u16(reply.payload + 4) == WRONG_STATE);
    tick(&d, 210000);
    assert(d.policy.last_control_us == 210000);
    request(&d, KEEPALIVE, 0, 0);
    ok();
    assert(d.lease_deadline == 710000);
    float angle = d.sim.angle;
    int64_t x = d.sim.position;
    put_u16(b, 0);
    request(&d, SELECT_POLICY, b, 2);
    ok();
    assert(!d.policy.running && d.state == STOPPING && d.sim.angle == angle && d.sim.position == x);
    tick(&d, 230000);
    assert(d.state == ARMED);
    put_f32(b, 100);
    request(&d, VELOCITY, b, 4);
    ok();
    tick(&d, 240000);
    put_u16(b, 1);
    request(&d, SELECT_POLICY, b, 2);
    ok();
    assert(d.policy.running && d.state == RUNNING && d.sim.target == d.sim.velocity);
    request(&d, DISARM, 0, 0);
    ok();
    // Explicit domain failure is observable, finite, and inhibits motion.
    for (unsigned i = 0; i < 24; ++i)
        b[i] = 0;
    put_f32(b, 3.14f);
    put_u64(b + 8, 7550);
    request(&d, SIM_STATE, b, 24);
    ok();
    request(&d, ARM, 0, 0);
    ok();
    request(&d, START_POLICY, 0, 0);
    ok();
    tick(&d, 250000);
    assert(d.state == FAULT && d.policy.error == POLICY_LOG_DOMAIN && d.sim.velocity == 0);
    request(&d, GET_POLICY, 0, 0);
    assert(reply.type == POLICY_STATUS && (reply.payload[7] >> 1) == POLICY_LOG_DOMAIN);
    request(&d, CLEAR_FAULT, 0, 0);
    ok();
    request(&d, SIM_RESET, 0, 0);
    ok();
    request(&d, ARM, 0, 0);
    ok();
    request(&d, START_POLICY, 0, 0);
    ok();
    // Renewal remains required for autonomous policy operation.
    tick(&d, 751000);
    assert(d.state == FAULT && !d.policy.running);
    put_u32(b, 0);
    put_u16(b + 4, 0);
    put_u16(b + 6, 0);
    request(&d, SUBSCRIBE, b, 8);
    unsigned count = selected_count;
    tick(&d, 851000);
    assert(count == selected_count);
    /* Logging levels, rate limits, exact counters and TX backpressure. */
    device_init(&d, collect, 0);
    next_id = 1;
    log_count = 0;
    put_u64(b, 123);
    request(&d, HELLO, b, 8);
    assert(log_count == 1 && last_log.length == 32 && last_log.payload[12] == 20);
    request(&d, GET_LOG_CONFIG, 0, 0);
    assert(reply.type == LOG_CONFIG && reply.payload[4] == 20);
    b[0] = 30;
    request(&d, SET_LOG_LEVEL, b, 1);
    unsigned before = log_count;
    put_u16(b, 999);
    request(&d, SELECT_POLICY, b, 2);
    assert(log_count == before + 1 && last_log.payload[12] == 30 &&
           get_u16(last_log.payload + 14) == 11);
    b[0] = 40;
    request(&d, SET_LOG_LEVEL, b, 1);
    before = log_count;
    put_u16(b, 999);
    request(&d, SELECT_POLICY, b, 2);
    assert(log_count == before);
    b[0] = 10;
    request(&d, SET_LOG_LEVEL, b, 1);
    put_u16(b, 999);
    for (unsigned i = 0; i < 50; ++i)
        request(&d, SELECT_POLICY, b, 2);
    assert(log_count == 10 && d.log_dropped > 0);
    device_tick(&d, 1000000);
    put_u16(b, 999);
    request(&d, SELECT_POLICY, b, 2);
    assert(get_u32(last_log.payload + 28) == d.log_dropped);
    reject_logs = true;
    uint32_t dropped = d.log_dropped;
    request(&d, SELECT_POLICY, b, 2);
    assert(d.log_dropped == dropped + 1 && d.state == IDLE && d.faults == 0);
    reject_logs = false;
    request(&d, GET_LOG_CONFIG, 0, 0);
    assert(get_u32(reply.payload + 8) == d.log_dropped);
    b[0] = 0;
    request(&d, SET_LOG_LEVEL, b, 1);
    before = log_count;
    put_u16(b, 999);
    request(&d, SELECT_POLICY, b, 2);
    assert(log_count == before);
    /* The recovery policy retries within RUNNING and exposes its diagnostics. */
    device_init(&d, collect, 0);
    next_id = 1;
    put_u64(b, 123);
    request(&d, HELLO, b, 8);
    put_u16(b, POLICY_RECOVERY);
    request(&d, SELECT_POLICY, b, 2);
    ok();
    for (unsigned i = 0; i < 24; i++)
        b[i] = 0;
    request(&d, SIM_STATE, b, 24);
    ok();
    request(&d, ARM, 0, 0);
    ok();
    request(&d, START_POLICY, 0, 0);
    ok();
    tick(&d, 20000);
    assert(d.state == RUNNING && d.policy.phase == POLICY_LQR);
    d.sim.angle = .8f;
    tick(&d, 30000);
    assert(d.state == RUNNING && !d.faults && d.policy.running && d.policy.recovery_count == 1);
    request(&d, GET_POLICY, 0, 0);
    assert(reply.type == POLICY_STATUS && reply.payload[6] == POLICY_SWING_UP &&
           reply.payload[7] == 1);
    put_u32(b, 1U << 24);
    put_u16(b + 4, 25);
    put_u16(b + 6, 0);
    request(&d, SUBSCRIBE, b, 8);
    tick(&d, 40000);
    assert(selected.length == 32 && get_u32(selected.payload + 24) == (1U << 24) &&
           get_f32(selected.payload + 28) == 1);
    d.sim.position = 7550;
    d.sim.fractional_position = 0;
    d.sim.velocity = 0;
    d.sim.target = 0;
    d.sim.angle = 3.14f;
    tick(&d, 50000);
    assert(d.policy.phase == POLICY_RECENTER && !d.faults && d.state == RUNNING);
    request(&d, STOP, 0, 0);
    ok();
    tick(&d, 70000);
    assert(d.state == ARMED && !d.policy.running);
    request(&d, START_POLICY, 0, 0);
    ok();
    assert(d.policy.recovery_count == 0 && !d.policy.measurement_initialized);
    tick(&d, 650000);
    assert(d.state == FAULT && (d.faults & (1U << 5)) && !d.policy.running);
    puts("Device catalog, sparse stream, live policy changes, domain fault and lease passed.");
}
