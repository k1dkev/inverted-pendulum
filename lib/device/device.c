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
/* Structured diagnostic frames are best effort, max 10/s, and use the
 * low-priority TX budget. They can never consume the response reserve. */
static void log_record(device_t *d, uint8_t level, uint8_t subsystem, uint16_t code, uint32_t a,
                       uint32_t b, uint32_t c)
{
    if (!d->session || !d->log_level || level < d->log_level)
        return;
    if (d->now - d->log_window >= 1000000)
    {
        d->log_window = d->now;
        d->log_count = 0;
    }
    uint32_t sequence = ++d->log_sequence;
    if (d->log_count >= 10)
    {
        if (d->log_dropped < UINT32_MAX)
            ++d->log_dropped;
        return;
    }
    ++d->log_count;
    packet_t p = {0};
    p.type = LOG_RECORD;
    p.session = d->session;
    p.length = 32;
    put_u64(p.payload, d->now);
    put_u32(p.payload + 8, sequence);
    p.payload[12] = level;
    p.payload[13] = subsystem;
    put_u16(p.payload + 14, code);
    put_u32(p.payload + 16, a);
    put_u32(p.payload + 20, b);
    put_u32(p.payload + 24, c);
    put_u32(p.payload + 28, d->log_dropped);
    if (!send_packet(d, &p, true) && d->log_dropped < UINT32_MAX)
        ++d->log_dropped;
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
    log_record(d, code == 2 ? 40 : 20, code >= 5 ? 3 : 1, code, d->state, d->faults, d->sim.paused);
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
    policy_stop(&d->policy);
    d->sim.acceleration_controlled = false;
    d->sim.command_acceleration = 0;
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
    d->log_level = 20;
    policy_init(&d->policy, POLICY_MANUAL);
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
    put_u16(reply->payload + 6, 127);
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
static unsigned copy_string(uint8_t *out, const char *text)
{
    unsigned n = 0;
    while (text[n])
    {
        out[n] = (uint8_t)text[n];
        ++n;
    }
    return n;
}
static unsigned text_length(const char *text)
{
    unsigned n = 0;
    while (text[n])
        ++n;
    return n;
}
static void policy_status(device_t *d, packet_t *reply, uint32_t request)
{
    reply->type = POLICY_STATUS;
    reply->length = 24;
    reply->session = d->session;
    put_u32(reply->payload, request);
    put_u16(reply->payload + 4, d->policy.id);
    reply->payload[6] = d->policy.phase;
    reply->payload[7] = (d->policy.running ? 1 : 0) | (d->policy.error << 1);
    put_u32(reply->payload + 8, d->config_revision);
    put_f32(reply->payload + 12, d->policy.raw_acceleration);
    put_f32(reply->payload + 16, d->policy.filtered_velocity);
    put_f32(reply->payload + 20, d->policy.integral);
}
static void subscription_status(device_t *d, packet_t *reply, uint32_t request)
{
    reply->type = SUBSCRIPTION;
    reply->length = 16;
    put_u32(reply->payload, request);
    put_u16(reply->payload + 4, TELEMETRY_SCHEMA_VERSION);
    put_u16(reply->payload + 6, d->selected_hz);
    put_u32(reply->payload + 8, d->selected_mask);
    put_u32(reply->payload + 12, d->subscription_revision);
}
static float selected_value(device_t *d, unsigned channel, bool *valid)
{
    double x = (double)d->sim.position + d->sim.fractional_position;
    if (((channel >= 6 && channel <= 12) || channel == 15 || channel == 24) &&
        ((d->policy.id != POLICY_LEGACY && d->policy.id != POLICY_RECOVERY && d->policy.id != POLICY_V3) ||
         d->policy.phase == POLICY_OFF))
        *valid = false;
    if (channel >= 25 && (d->policy.id != POLICY_V3 || d->policy.phase == POLICY_OFF))
        *valid = false;
    if ((channel == 8 || channel == 9 || channel == 10) && d->policy.id == POLICY_V3)
        *valid = false; /* Legacy energy channels use physical, not normalized units. */
    switch (channel)
    {
    case 0:
        return d->sim.angle;
    case 1:
        return d->sim.angular_velocity;
    case 2:
        return (float)(x * SIM_MM_PER_PULSE);
    case 3:
        return d->sim.velocity * SIM_MM_PER_PULSE;
    case 4:
        return d->sim.acceleration * SIM_MM_PER_PULSE;
    case 5:
        return d->sim.target * SIM_MM_PER_PULSE;
    case 6:
        return d->policy.raw_acceleration;
    case 7:
        return d->policy.applied_acceleration;
    case 8:
        return d->policy.energy;
    case 9:
        return d->policy.energy_fraction;
    case 10:
        return d->policy.energy_threshold;
    case 11:
        return d->policy.integral;
    case 12:
        return d->policy.elapsed_s;
    case 13:
        return d->policy.phase;
    case 14:
        return d->policy.id;
    case 15:
        return d->policy.filtered_velocity;
    case 16:
        return d->simulation_parameters.inertia_kg_m2;
    case 17:
        return d->simulation_parameters.damping_n_m_s;
    case 18:
        return d->lease_active && d->lease_deadline > d->now
                   ? (float)(d->lease_deadline - d->now) / 1000
                   : 0;
    case 19:
        return (float)d->parser.errors;
    case 20:
        return (float)d->dropped;
    case 21:
        return x <= -SIM_BOUND_PULSES ? 1 : 0;
    case 22:
        return x >= SIM_BOUND_PULSES ? 1 : 0;
    case 23:
        return d->state;
    case 24:
        return (float)d->policy.recovery_count;
    case 25: return d->policy.v3_a;
    case 26: return d->policy.v3_c;
    case 27: return d->policy.v3_excited ? 1 : 0;
    case 28: return (float)d->policy.v3_updates;
    case 29: return (float)d->policy.v3_rejected;
    default:
        *valid = false;
        return 0;
    }
}
static uint16_t command(device_t *d, const packet_t *p, packet_t *reply)
{
    const uint8_t *b = p->payload;
    if (p->type == GET_LOG_CONFIG || p->type == SET_LOG_LEVEL)
    {
        if (p->type == GET_LOG_CONFIG && p->length)
            return BAD_PAYLOAD;
        if (p->type == SET_LOG_LEVEL)
        {
            if (p->length != 1 ||
                (b[0] != 0 && b[0] != 10 && b[0] != 20 && b[0] != 30 && b[0] != 40))
                return BAD_PAYLOAD;
            d->log_level = b[0];
        }
        reply->type = LOG_CONFIG;
        reply->length = 12;
        put_u32(reply->payload, p->id);
        reply->payload[4] = d->log_level;
        reply->payload[5] = reply->payload[6] = reply->payload[7] = 0;
        put_u32(reply->payload + 8, d->log_dropped);
        return OK;
    }
    if (p->type == LIST_POLICIES)
    {
        if (p->length != 2)
            return BAD_PAYLOAD;
        uint16_t index = get_u16(b);
        const policy_descriptor_t *info = policy_descriptor(index);
        if (!info)
            return BAD_PAYLOAD;
        unsigned name_length = text_length(info->name);
        if (name_length > UINT8_MAX || 12 + name_length > PROTO_MAX_PAYLOAD)
            return NOT_CONFIGURED;
        reply->type = POLICY_DESCRIPTOR;
        put_u32(reply->payload, p->id);
        put_u16(reply->payload + 4, policy_count());
        put_u16(reply->payload + 6, index);
        put_u16(reply->payload + 8, info->id);
        reply->payload[10] = (uint8_t)text_length(info->name);
        reply->payload[11] = info->id ? 3 : 2;
        reply->length = (uint16_t)(12 + copy_string(reply->payload + 12, info->name));
        return OK;
    }
    if (p->type == GET_POLICY)
    {
        if (p->length)
            return BAD_PAYLOAD;
        policy_status(d, reply, p->id);
        return OK;
    }
    if (p->type == SELECT_POLICY)
    {
        if (p->length != 2)
            return BAD_PAYLOAD;
        uint16_t id = get_u16(b);
        bool found = false;
        for (unsigned i = 0; i < policy_count(); ++i)
            if (policy_descriptor(i)->id == id)
                found = true;
        if (!found)
            return UNSUPPORTED;
        if (d->faults || d->state == FAULT)
            return FAULT_ACTIVE;
        if (d->sim.paused && d->state != IDLE)
            return WRONG_STATE;
        bool was_running = d->state == RUNNING;
        if (d->state == STOPPING)
            return WRONG_STATE;
        policy_init(&d->policy, id);
        d->sim.acceleration_controlled = false;
        d->sim.command_acceleration = 0;
        ++d->config_revision;
        if (was_running && id)
        {
            policy_start(&d->policy, d->now);
            d->sim.target = d->sim.velocity;
            d->sim.acceleration_controlled = true;
            d->sim.command_acceleration = 0;
            d->sim.command_velocity_limit = POLICY_MAX_VELOCITY_MM_S / SIM_MM_PER_PULSE;
        }
        else if (was_running)
        {
            d->sim.target = 0;
            d->lease_active = false;
            set_state(d, STOPPING);
        }
        if (d->state == RUNNING)
        {
            d->lease_active = true;
            d->lease_deadline = d->now + 500000;
        }
        log_record(d, 20, 2, 7, id, was_running, d->config_revision);
        return OK;
    }
    if (p->type == START_POLICY)
    {
        if (p->length)
            return BAD_PAYLOAD;
        if (d->state != ARMED || !d->manual_armed || d->sim.paused)
            return WRONG_STATE;
        if (!d->policy.id)
            return WRONG_STATE;
        policy_start(&d->policy, d->now);
        d->sim.acceleration_controlled = true;
        d->sim.command_acceleration = 0;
        d->sim.command_velocity_limit = POLICY_MAX_VELOCITY_MM_S / SIM_MM_PER_PULSE;
        d->lease_active = true;
        d->lease_deadline = d->now + 500000;
        set_state(d, RUNNING);
        return OK;
    }
    if (p->type == TELEMETRY_CATALOG)
    {
        if (p->length != 2)
            return BAD_PAYLOAD;
        uint16_t id = get_u16(b);
        const telemetry_descriptor_t *info = telemetry_descriptor(id);
        if (!info)
            return BAD_PAYLOAD;
        unsigned name_length = text_length(info->name), unit_length = text_length(info->unit),
                 description_length = text_length(info->description);
        if (name_length > UINT8_MAX || unit_length > UINT8_MAX || description_length > UINT8_MAX ||
            16 + name_length + unit_length + description_length > PROTO_MAX_PAYLOAD)
            return NOT_CONFIGURED;
        reply->type = TELEMETRY_DESCRIPTOR;
        put_u32(reply->payload, p->id);
        put_u16(reply->payload + 4, TELEMETRY_SCHEMA_VERSION);
        put_u16(reply->payload + 6, TELEMETRY_CHANNELS);
        put_u16(reply->payload + 8, id);
        reply->payload[10] = 1;
        reply->payload[11] = 0;
        reply->payload[12] = (uint8_t)text_length(info->name);
        reply->payload[13] = (uint8_t)text_length(info->unit);
        reply->payload[14] = (uint8_t)text_length(info->description);
        reply->payload[15] = 0;
        unsigned n = 16;
        n += copy_string(reply->payload + n, info->name);
        n += copy_string(reply->payload + n, info->unit);
        n += copy_string(reply->payload + n, info->description);
        reply->length = (uint16_t)n;
        return OK;
    }
    if (p->type == GET_SUBSCRIPTION)
    {
        if (p->length)
            return BAD_PAYLOAD;
        subscription_status(d, reply, p->id);
        return OK;
    }
    if (p->type == SUBSCRIBE)
    {
        if (p->length != 8 || get_u16(b + 6))
            return BAD_PAYLOAD;
        uint32_t mask = get_u32(b);
        uint16_t hz = get_u16(b + 4);
        if (mask & ~TELEMETRY_VALID_MASK || (hz != 0 && hz != 5 && hz != 10 && hz != 25))
            return BAD_PAYLOAD;
        d->selected_mask = mask;
        d->selected_hz = hz;
        ++d->subscription_revision;
        subscription_status(d, reply, p->id);
        return OK;
    }
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
        /* Presence sustains a stationary arm or autonomous policy. A moving
         * manual target still requires fresh velocity commands. */
        if ((d->state == ARMED && d->sim.velocity == 0 && d->sim.target == 0) || d->policy.running)
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
        if (d->policy.id != POLICY_MANUAL)
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
        bool running_policy = d->state == RUNNING && d->policy.running && d->policy.id != POLICY_MANUAL;
        if (d->state != IDLE && !running_policy)
            return WRONG_STATE;
        if (running_policy && b[20])
            return WRONG_STATE;
        simulation_reset(&d->sim);
        d->sim.angle = get_f32(b);
        d->sim.angular_velocity = get_f32(b + 4);
        d->sim.position = position;
        d->sim.velocity = get_f32(b + 16);
        d->sim.target = d->sim.velocity;
        d->sim.paused = b[20] != 0;
        if (running_policy)
        {
            /* Reset controller and estimator histories after a discontinuous
             * simulated state change while retaining the active policy/lease. */
            policy_start(&d->policy, d->now);
            d->sim.acceleration_controlled = true;
            d->sim.command_velocity_limit = POLICY_MAX_VELOCITY_MM_S / SIM_MM_PER_PULSE;
        }
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
        policy_stop(&d->policy);
        d->sim.acceleration_controlled = false;
        d->sim.command_acceleration = 0;
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
            d->selected_mask = 0;
            d->selected_hz = 0;
            d->subscription_revision = 1;
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
    if (result != OK && p->session == d->session)
        log_record(d, 30, 4, 11, p->type, result, p->id);
    if (result == OK && hello)
        log_record(d, 20, 4, 10, 0, 0, 0);
    if (result == OK &&
        (p->type == SET_ACCELERATION || p->type == SIM_SET_PARAMETERS || p->type == SET_LOG_LEVEL))
        log_record(d, 20, 1, 9, p->type, d->config_revision, 0);
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
        policy_stop(&d->policy);
        d->sim.acceleration_controlled = false;
        d->sim.command_acceleration = 0;
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
        d->policy.realized_acceleration = d->sim.acceleration * SIM_MM_PER_PULSE;
        if (d->policy.running && d->state == RUNNING && !d->sim.paused &&
            policy_update(&d->policy, d->last_tick, (float)d->sim.position * SIM_MM_PER_PULSE,
                          d->sim.velocity * SIM_MM_PER_PULSE, d->sim.angle))
        {
            if (d->policy.error)
                fault(d, 1U << 7);
            else
            {
                float velocity = d->sim.velocity * SIM_MM_PER_PULSE +
                                 d->policy.applied_acceleration * d->policy.sample_dt;
                const float limit = POLICY_MAX_VELOCITY_MM_S;
                if (velocity > limit)
                    velocity = limit;
                if (velocity < -limit)
                    velocity = -limit;
                d->sim.target = velocity / SIM_MM_PER_PULSE;
                d->sim.command_acceleration = d->policy.applied_acceleration / SIM_MM_PER_PULSE;
            }
        }
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
        else if (d->state == RUNNING && !d->policy.running && d->sim.target == 0 &&
                 d->sim.velocity == 0)
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
    if (d->policy.id != d->logged_policy || d->policy.phase != d->logged_phase ||
        d->policy.error != d->logged_error)
    {
        d->logged_policy = d->policy.id;
        d->logged_phase = d->policy.phase;
        d->logged_error = d->policy.error;
        log_record(d, d->policy.error ? 40 : 20, 2, 8, d->policy.id, d->policy.phase,
                   d->policy.error);
    }
    if (d->session && now - d->last_policy_status >= 100000)
    {
        d->last_policy_status = now;
        packet_t status = {0};
        policy_status(d, &status, 0);
        (void)send_packet(d, &status, true);
    }
    if (d->session && d->selected_hz && d->selected_mask &&
        now - d->last_selected_sample >= 1000000U / d->selected_hz)
    {
        d->last_selected_sample = now;
        packet_t packet = {0};
        packet.type = SELECTED_TELEMETRY;
        packet.session = d->session;
        put_u64(packet.payload, now);
        put_u32(packet.payload + 8, ++d->selected_sample_seq);
        put_u32(packet.payload + 12, d->selected_mask);
        put_u32(packet.payload + 16, d->subscription_revision);
        put_u16(packet.payload + 20, TELEMETRY_SCHEMA_VERSION);
        put_u16(packet.payload + 22, d->selected_hz);
        uint32_t valid_mask = 0;
        unsigned n = 28;
        for (unsigned id = 0; id < TELEMETRY_CHANNELS; ++id)
            if (d->selected_mask & (1U << id))
            {
                bool valid = true;
                float value = selected_value(d, id, &valid);
                if (!is_finite(value))
                    valid = false;
                if (valid)
                    valid_mask |= 1U << id;
                put_f32(packet.payload + n, valid ? value : 0);
                n += 4;
            }
        put_u32(packet.payload + 24, valid_mask);
        packet.length = (uint16_t)n;
        if (!send_packet(d, &packet, true) && d->dropped < UINT32_MAX)
            ++d->dropped;
    }
}
