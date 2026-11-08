#include "device.h"
#include <assert.h>
#include <stdio.h>
static packet_t last_response;
static unsigned response_count;
static parser_t output_parser;
static bool collect(void *ctx, const uint8_t *bytes, size_t n, bool telemetry)
{
    (void)ctx;
    (void)telemetry;
    packet_t p;
    for (size_t i = 0; i < n; ++i)
        if (proto_feed(&output_parser, bytes[i], &p) &&
            (p.type == RESPONSE || p.type == HELLO_INFO || p.type == STATUS))
        {
            last_response = p;
            ++response_count;
        }
    return true;
}
static void request(device_t *d, uint8_t type, uint32_t id, const uint8_t *payload, uint16_t length)
{
    packet_t p = {0};
    p.type = type;
    p.id = id;
    p.session = type == HELLO ? 0 : 123;
    p.length = length;
    for (unsigned i = 0; i < length; ++i)
        p.payload[i] = payload[i];
    uint8_t bytes[PROTO_MAX_FRAME];
    size_t n = proto_encode(&p, bytes);
    for (size_t i = 0; i < n; ++i)
        device_receive(d, bytes[i]);
}
int main(void)
{
    assert(proto_crc((const uint8_t *)"123456789", 9) == 0xcbf43926U);
    for (unsigned length = 0; length <= PROTO_MAX_PAYLOAD; ++length)
    {
        packet_t a = {0}, b;
        parser_t parser = {0};
        a.type = 0x31;
        a.id = 0xfedcba98U;
        a.session = 0x123456789abcdef0ULL;
        a.length = (uint16_t)length;
        for (unsigned i = 0; i < length; ++i)
            a.payload[i] = (uint8_t)i;
        uint8_t bytes[PROTO_MAX_FRAME];
        size_t n = proto_encode(&a, bytes);
        assert(n <= PROTO_MAX_FRAME);
        bool got = false;
        for (size_t i = 0; i < n; ++i)
            got = proto_feed(&parser, bytes[i], &b);
        assert(got && b.length == a.length && b.session == a.session && b.id == a.id);
        for (unsigned i = 0; i < length; ++i)
            assert(b.payload[i] == a.payload[i]);
        bytes[n / 2] ^= 0x40;
        got = false;
        for (size_t i = 0; i < n; ++i)
            got |= proto_feed(&parser, bytes[i], &b);
        assert(!got);
    }
    static device_t d;
    device_init(&d, collect, NULL);
    uint8_t hello[8];
    put_u64(hello, 123);
    request(&d, HELLO, 1, hello, 8);
    assert(last_response.type == HELLO_INFO && d.session == 123);
    request(&d, ARM, 2, NULL, 0);
    assert(d.state == ARMED);
    uint8_t velocity[4];
    put_f32(velocity, 200);
    request(&d, VELOCITY, 3, velocity, 4);
    assert(d.state == RUNNING);
    for (uint64_t t = 1000; t <= 100000; t += 1000)
        device_tick(&d, t);
    assert(d.sim.position > 0 && d.sim.velocity > 0);
    uint64_t deadline = d.lease_deadline;
    request(&d, VELOCITY, 3, velocity, 4);
    assert(d.lease_deadline == deadline);
    put_f32(velocity, 201);
    request(&d, VELOCITY, 3, velocity, 4);
    assert(get_u16(last_response.payload + 4) == ID_REUSE);
    put_f32(velocity, 30000);
    request(&d, VELOCITY, 4, velocity, 4);
    assert(get_u16(last_response.payload + 4) == LIMIT_EXCEEDED);
    request(&d, SIM_RESET, 5, NULL, 0);
    assert(get_u16(last_response.payload + 4) == WRONG_STATE);
    for (uint64_t t = 101000; t <= 1000000; t += 1000)
        device_tick(&d, t);
    assert(d.state == FAULT && d.sim.velocity == 0 && (d.faults & (1U << 5)));
    request(&d, CLEAR_FAULT, 6, NULL, 0);
    request(&d, SIM_RESET, 7, NULL, 0);
    assert(d.state == IDLE && d.sim.position == 0);
    uint8_t state[24] = {0};
    put_f32(state, 1);
    put_f32(state + 4, 0.5f);
    put_u64(state + 8, (uint64_t)-100);
    put_f32(state + 16, 20);
    state[20] = 1;
    request(&d, SIM_STATE, 8, state, 24);
    assert(get_u16(last_response.payload + 4) == OK && d.sim.position == -100 && d.sim.paused);
    float angle = d.sim.angle;
    device_tick(&d, 1001000);
    assert(d.sim.angle == angle);
    request(&d, ARM, 9, NULL, 0);
    assert(get_u16(last_response.payload + 4) == WRONG_STATE);
    request(&d, DISARM, 10, NULL, 0);
    assert(d.sim.velocity == 0);
    request(&d, SIM_STATE, 11, state, 24);
    request(&d, STOP, 12, NULL, 0);
    assert(d.state == IDLE && d.sim.paused && d.sim.velocity == 0);
    put_u32(state, 0x7fc00000U); /* NaN cannot enter the physics integrator. */
    request(&d, SIM_STATE, 13, state, 24);
    assert(get_u16(last_response.payload + 4) == BAD_PAYLOAD);
    uint32_t id = 14;
    uint8_t acceleration[4];
    put_f32(acceleration, 5000); /* 100 mm/s² with the legacy 0.02 mm/pulse. */
    request(&d, SET_ACCELERATION, id, acceleration, 4);
    assert(get_u16(last_response.payload + 4) == OK && d.acceleration_limit == 5000);
    uint32_t revision = d.config_revision;
    request(&d, SET_ACCELERATION, id++, acceleration, 4);
    assert(d.config_revision == revision); /* Retry must not apply twice. */
    request(&d, GET_CONFIG, id++, NULL, 0);
    assert(last_response.type == HELLO_INFO && get_f32(last_response.payload + 20) == 5000);
    request(&d, SIM_RESET, id++, NULL, 0);
    assert(d.acceleration_limit == 5000); /* Physics reset preserves configuration. */
    request(&d, ARM, id++, NULL, 0);
    for (uint64_t t = 1002000; t <= 7001000; t += 1000)
    {
        device_tick(&d, t);
        if (t % 50000 == 0)
            request(&d, KEEPALIVE, id++, NULL, 0);
    }
    assert(d.state == ARMED); /* No five-second auto-disarm between jogs. */
    put_f32(velocity, 200);
    request(&d, VELOCITY, id++, velocity, 4);
    for (uint64_t t = 7002000; t <= 7021000; t += 1000)
        device_tick(&d, t);
    assert(d.sim.velocity == 100 && d.sim.acceleration == 5000);
    request(&d, SET_ACCELERATION, id++, acceleration, 4);
    assert(get_u16(last_response.payload + 4) == WRONG_STATE);
    request(&d, STOP, id++, NULL, 0);
    for (uint64_t t = 7022000; t <= 7042000; t += 1000)
        device_tick(&d, t);
    assert(d.state == ARMED && d.sim.velocity == 0);
    put_f32(velocity, -200);
    request(&d, VELOCITY, id++, velocity, 4);
    assert(d.state == RUNNING); /* Second jog needs no ARM. */
    /* Presence heartbeats must not sustain an abandoned nonzero jog target. */
    for (uint64_t t = 7043000; t <= 7742000; t += 1000)
    {
        device_tick(&d, t);
        if (t % 50000 == 0)
            request(&d, KEEPALIVE, id++, NULL, 0);
    }
    assert(d.state == FAULT && d.sim.velocity == 0 && !d.manual_armed);
    assert(response_count >= 10);
    puts("Core framing, duplicate protection, motion lease, and simulation state tests passed.");
    return 0;
}
