#include "device.h"

static bool is_finite(float v) { return __builtin_isfinite(v); }
static float absf(float v) { return v < 0 ? -v : v; }
static bool send_packet(device_t *d, packet_t *p, bool telemetry)
{
    if (d->tx_id == UINT32_MAX)
        return false;
    uint8_t bytes[PROTO_MAX_FRAME];
    p->id = ++d->tx_id;
    size_t length = proto_encode(p, bytes);
    return length && d->send(d->context, bytes, length, telemetry);
}
static void event(device_t *d, uint16_t code)
{
    if (!d->session)
        return;
    packet_t p = {0};
    p.type = EVENT;
    p.length = 16;
    p.session = d->session;
    put_u64(p.payload, d->now);
    put_u16(p.payload + 8, code);
    p.payload[10] = d->state;
    p.payload[11] = 2;
    put_u32(p.payload + 12, d->faults);
    (void)send_packet(d, &p, false);
}
static void set_state(device_t *d, uint8_t state)
{
    if (d->state != state)
    {
        d->state = state;
        event(d, 1);
    }
}
static void inhibit(device_t *d)
{
    d->sim.target = 0;
    d->sim.velocity = 0;
    d->sim.acceleration = 0;
    d->lease_active = false;
    d->manual_armed = false;
}
static void fault(device_t *d, uint32_t bit)
{
    d->faults |= bit;
    inhibit(d);
    set_state(d, FAULT);
    event(d, 2);
}
static void snapshot(device_t *d, uint8_t *p)
{
    double cart_position = (double)d->sim.position + d->sim.fractional_position;
    put_u64(p, d->now);
    put_u32(p + 8, d->sample_seq);
    put_u32(p + 12, 0x27U | ((d->state == RUNNING) ? 8U : 0U) | (d->sim.paused ? 64U : 0U) |
                        (cart_position <= -SIM_BOUND_PULSES ? 128U : 0U) |
                        (cart_position >= SIM_BOUND_PULSES ? 256U : 0U));
    put_u64(p + 16, (uint64_t)d->sim.position);
    put_f32(p + 24, d->sim.angle);
    put_f32(p + 28, d->sim.angular_velocity);
    put_f32(p + 32, d->sim.velocity);
    put_f32(p + 36, d->sim.acceleration);
    put_f32(p + 40, d->sim.target);
    put_u16(p + 44, (uint16_t)((d->sim.angle + 3.14159265f) * 651.73949f));
    p[46] = d->state;
    p[47] = 2;
    put_u32(p + 48, d->faults);
    put_u32(p + 52, d->dropped);
    put_u32(p + 56, 0);
    put_f32(p + 60, absf(d->sim.velocity));
}
void device_init(device_t *d, device_send_fn send, void *context)
{
    *d = (device_t){0};
    d->send = send;
    d->context = context;
    d->state = IDLE;
    d->telemetry_hz = 50;
    d->acceleration_limit = SIM_DEFAULT_ACCELERATION;
    d->config_revision = 1;
    d->simulation_parameters.inertia_kg_m2 = SIM_DEFAULT_INERTIA;
    d->simulation_parameters.damping_n_m_s = SIM_DEFAULT_DAMPING;
    simulation_reset(&d->sim);
}
static uint32_t fingerprint(const packet_t *p)
{
    uint8_t bytes[PROTO_MAX_PAYLOAD + 1];
    bytes[0] = p->type;
    for (unsigned i = 0; i < p->length; ++i)
        bytes[1 + i] = p->payload[i];
    return proto_crc(bytes, 1U + p->length);
}
static void hello_info(device_t *d, packet_t *reply, uint32_t request)
{
    reply->type = HELLO_INFO;
    reply->length = 48;
    put_u32(reply->payload, request);
    put_u16(reply->payload + 4, 1);
    put_u16(reply->payload + 6, 15);
    put_u32(reply->payload + 8, 0x000100);
    put_u32(reply->payload + 12, 1000);
    put_f32(reply->payload + 16, SIM_MAX_VELOCITY);
    put_f32(reply->payload + 20, d->acceleration_limit);
    put_f32(reply->payload + 24, d->acceleration_limit);
    put_u32(reply->payload + 28, SIM_PULSES_PER_REV);
    put_f32(reply->payload + 32, SIM_MM_PER_PULSE);
    put_u16(reply->payload + 36, 500);
    put_u16(reply->payload + 38, 50);
    put_u32(reply->payload + 40, d->config_revision);
}
static uint16_t command(device_t *d, const packet_t *p, packet_t *reply)
{
    const uint8_t *b = p->payload;
    if (p->type == SIM_GET_PARAMETERS)
    {
        if (p->length)
            return BAD_PAYLOAD;
        reply->type = SIM_PARAMETERS;
        reply->length = 28;
        put_u32(reply->payload, p->id);
        put_f32(reply->payload + 4, d->simulation_parameters.inertia_kg_m2);
        put_f32(reply->payload + 8, d->simulation_parameters.damping_n_m_s);
        put_f32(reply->payload + 12, SIM_MASS_KG);
        put_f32(reply->payload + 16, SIM_COM_M);
        put_f32(reply->payload + 20, -190);
        put_f32(reply->payload + 24, 190);
        return OK;
    }
    if (p->type == SIM_SET_PARAMETERS)
    {
        if (p->length != 8 || !is_finite(get_f32(b)) || !is_finite(get_f32(b + 4)))
            return BAD_PAYLOAD;
        float inertia = get_f32(b), damping = get_f32(b + 4);
        if (inertia < SIM_MIN_INERTIA || inertia > SIM_MAX_INERTIA || damping < 0 ||
            damping > SIM_MAX_DAMPING)
            return LIMIT_EXCEEDED;
        if ((d->state != IDLE && d->state != ARMED) || d->sim.velocity != 0 || d->sim.target != 0)
            return WRONG_STATE;
        d->simulation_parameters.inertia_kg_m2 = inertia;
        d->simulation_parameters.damping_n_m_s = damping;
        ++d->config_revision;
        return OK;
    }
    if (p->type == GET_CONFIG)
    {
        if (p->length)
            return BAD_PAYLOAD;
        hello_info(d, reply, p->id);
        return OK;
    }
    if (p->type == KEEPALIVE)
    {
        if (p->length)
            return BAD_PAYLOAD;
        /* Presence sustains a stationary armed session, never a moving target. */
        if (d->state == ARMED && d->sim.velocity == 0 && d->sim.target == 0)
        {
            d->lease_active = true;
            d->lease_deadline = d->now + 500000;
        }
        return OK;
    }
    if (p->type == SET_ACCELERATION)
    {
        if (p->length != 4 || !is_finite(get_f32(b)))
            return BAD_PAYLOAD;
        float acceleration = get_f32(b);
        if (acceleration < SIM_MIN_ACCELERATION || acceleration > SIM_MAX_ACCELERATION)
            return LIMIT_EXCEEDED;
        if (d->state != IDLE && d->state != ARMED)
            return WRONG_STATE;
        if (d->sim.velocity != 0 || d->sim.target != 0)
            return WRONG_STATE;
        d->acceleration_limit = acceleration;
        ++d->config_revision;
        return OK;
    }
    if (p->type == GET_STATUS)
    {
        if (p->length)
            return BAD_PAYLOAD;
        reply->type = STATUS;
        reply->length = 68;
        put_u32(reply->payload, p->id);
        snapshot(d, reply->payload + 4);
        return OK;
    }
    if (p->type == SET_TELEMETRY)
    {
        if (p->length != 2)
            return BAD_PAYLOAD;
        uint16_t hz = get_u16(b);
        if (hz != 0 && hz != 10 && hz != 25 && hz != 50)
            return BAD_PAYLOAD;
        if (d->state != IDLE)
            return WRONG_STATE;
        d->telemetry_hz = hz;
        return OK;
    }
    if (p->type == VELOCITY)
    {
        if (p->length != 4 || !is_finite(get_f32(b)))
            return BAD_PAYLOAD;
        float v = get_f32(b);
        if (absf(v) > SIM_MAX_VELOCITY)
            return LIMIT_EXCEEDED;
        if (!d->manual_armed || d->faults ||
            (d->state != ARMED && d->state != RUNNING && d->state != STOPPING) || d->sim.paused)
            return WRONG_STATE;
        d->sim.target = v;
        d->lease_active = true;
        d->lease_deadline = d->now + 500000;
        if (v != 0)
            set_state(d, RUNNING);
        return OK;
    }
    if (p->type == SIM_STATE)
    {
        if (p->length != 24 || !is_finite(get_f32(b)) || !is_finite(get_f32(b + 4)) ||
            !is_finite(get_f32(b + 16)) || b[20] > 1 || b[21] || b[22] || b[23])
            return BAD_PAYLOAD;
        int64_t position = (int64_t)get_u64(b + 8);
        if (absf(get_f32(b)) > 3.1415927f || absf(get_f32(b + 4)) > 50 ||
            absf(get_f32(b + 16)) > SIM_MAX_VELOCITY || position < -SIM_BOUND_PULSES ||
            position > SIM_BOUND_PULSES)
            return LIMIT_EXCEEDED;
        if (d->state != IDLE)
            return WRONG_STATE;
        simulation_reset(&d->sim);
        d->sim.angle = get_f32(b);
        d->sim.angular_velocity = get_f32(b + 4);
        d->sim.position = position;
        d->sim.velocity = get_f32(b + 16);
        d->sim.target = d->sim.velocity;
        d->sim.paused = b[20] != 0;
        event(d, 5);
        return OK;
    }
    if (p->type == SIM_PAUSE)
    {
        if (p->length != 1 || b[0] > 1)
            return BAD_PAYLOAD;
        if (d->state != IDLE)
            return WRONG_STATE;
        d->sim.paused = b[0] != 0;
        event(d, 6);
        return OK;
    }
    if (p->type != ARM && p->type != STOP && p->type != DISARM && p->type != CLEAR_FAULT &&
        p->type != ZERO && p->type != SIM_RESET)
        return UNSUPPORTED;
    if (p->length)
        return BAD_PAYLOAD;
    switch (p->type)
    {
    case ARM:
        if (d->faults)
            return FAULT_ACTIVE;
        if (d->state != IDLE || d->sim.paused)
            return WRONG_STATE;
        inhibit(d);
        d->manual_armed = true;
        d->lease_active = true;
        d->lease_deadline = d->now + 500000;
        set_state(d, ARMED);
        break;
    case STOP:
        if (d->state == FAULT)
            return FAULT_ACTIVE;
        d->sim.target = 0;
        d->lease_active = false;
        if (d->sim.paused)
        {
            inhibit(d);
            set_state(d, IDLE);
            break;
        }
        if (d->state != IDLE || d->sim.velocity != 0)
            set_state(d, STOPPING);
        break;
    case DISARM:
        inhibit(d);
        if (d->state != FAULT)
            set_state(d, IDLE);
        break;
    case CLEAR_FAULT:
        if (d->state != FAULT)
            return WRONG_STATE;
        d->faults = 0;
        inhibit(d);
        set_state(d, IDLE);
        event(d, 3);
        break;
    case ZERO:
        if (d->state != IDLE || d->sim.velocity != 0)
            return WRONG_STATE;
        d->sim.position = 0;
        d->sim.fractional_position = 0;
        event(d, 4);
        break;
    case SIM_RESET:
        if (d->state != IDLE)
            return WRONG_STATE;
        simulation_reset(&d->sim);
        event(d, 5);
        break;
    default:
        return UNSUPPORTED;
    }
    return OK;
}
static void dispatch(device_t *d, const packet_t *p)
{
    packet_t reply = {0};
    reply.type = RESPONSE;
    reply.length = 8;
    reply.session = p->session;
    uint16_t result = OK;
    bool cache = false;
    uint32_t fp = fingerprint(p);
    bool hello = p->type == HELLO && p->session == 0;
    uint64_t requested = hello && p->length == 8 ? get_u64(p->payload) : 0;
    if (hello && requested != 0 && requested != d->session)
    {
        if (d->state != IDLE && d->state != FAULT)
            result = BUSY;
        else if (p->id != 1)
            result = BAD_PAYLOAD;
        else
        {
            d->session = requested;
            d->last_request = 0;
            d->tx_id = 0;
            d->cache_next = 0;
            d->telemetry_hz = 50;
            for (unsigned i = 0; i < 16; ++i)
                d->cache[i].id = 0;
        }
    }
    else if (hello && (p->length != 8 || requested == 0))
        result = BAD_PAYLOAD;
    else if (!hello && (!d->session || p->session != d->session))
        result = BAD_SESSION;
    if (result == OK)
    {
        for (unsigned i = 0; i < 16; ++i)
            if (d->cache[i].id && d->cache[i].id == p->id)
            {
                if (d->cache[i].fingerprint == fp)
                {
                    (void)send_packet(d, &d->cache[i].reply, false);
                    return;
                }
                result = ID_REUSE;
                break;
            }
        if (result == OK && (p->id == 0 || p->id <= d->last_request))
            result = STALE_REQUEST;
        if (result == OK)
        {
            cache = true;
            d->last_request = p->id;
            reply.session = d->session;
            if (hello)
                hello_info(d, &reply, p->id);
            else
                result = command(d, p, &reply);
        }
    }
    if (result != OK || reply.type == RESPONSE)
    {
        reply.type = RESPONSE;
        reply.length = 8;
        put_u32(reply.payload, p->id);
        put_u16(reply.payload + 4, result);
        reply.payload[6] = d->state;
        reply.payload[7] = 2;
    }
    if (cache)
    {
        request_cache_t *c = &d->cache[d->cache_next];
        c->id = p->id;
        c->fingerprint = fp;
        c->reply = reply;
        d->cache_next = (uint8_t)((d->cache_next + 1) % 16);
    }
    if (!send_packet(d, &reply, false) && (d->state == ARMED || d->state == RUNNING))
        fault(d, 1U << 6);
}
void device_receive(device_t *d, uint8_t byte)
{
    packet_t p;
    d->last_rx = d->now;
    if (proto_feed(&d->parser, byte, &p))
        dispatch(d, &p);
}
void device_rx_overflow(device_t *d)
{
    proto_reset_frame(&d->parser);
    ++d->parser.errors;
    if (d->state == ARMED || d->state == RUNNING)
        fault(d, 1U << 6);
}
void device_tick(device_t *d, uint64_t now)
{
    d->now = now;
    if (d->parser.length && now - d->last_rx > 100000)
    {
        proto_reset_frame(&d->parser);
        ++d->parser.errors;
    }
    if (d->lease_active && now >= d->lease_deadline && (d->state == ARMED || d->state == RUNNING))
    {
        d->faults |= 1U << 5;
        d->sim.target = 0;
        d->lease_active = false;
        d->manual_armed = false;
        set_state(d, STOPPING);
    }
    if (now - d->last_tick > 32000)
    {
        d->last_tick = now;
        if (d->state == RUNNING || d->state == ARMED)
            fault(d, 1U << 4);
    }
    while (now - d->last_tick >= 1000)
    {
        d->last_tick += 1000;
        simulation_tick(&d->sim, 0.001f, d->acceleration_limit, &d->simulation_parameters);
        if (d->state == STOPPING && d->sim.velocity == 0)
        {
            bool remain_armed = d->manual_armed && !d->faults;
            inhibit(d);
            d->manual_armed = remain_armed;
            if (remain_armed)
            {
                d->lease_active = true;
                d->lease_deadline = now + 500000;
            }
            set_state(d, d->faults ? FAULT : remain_armed ? ARMED : IDLE);
            if (d->faults)
                event(d, 2);
        }
        else if (d->state == RUNNING && d->sim.target == 0 && d->sim.velocity == 0)
            set_state(d, ARMED);
    }
    if (d->session && d->telemetry_hz && now - d->last_sample >= 1000000U / d->telemetry_hz)
    {
        d->last_sample = now;
        ++d->sample_seq;
        packet_t p = {0};
        p.type = TELEMETRY;
        p.length = 64;
        p.session = d->session;
        snapshot(d, p.payload);
        if (!send_packet(d, &p, true) && d->dropped < UINT32_MAX)
            ++d->dropped;
    }
}
