#ifndef PENDULUM_POLICY_H
#define PENDULUM_POLICY_H
#include <stdbool.h>
#include <stdint.h>

#define POLICY_MAX_VELOCITY_MM_S ((float)(62.83 * 16.0 / 3.14159265358979323846))

enum
{
    POLICY_MANUAL = 0,
    POLICY_LEGACY = 1,
    POLICY_RECOVERY = 2
};
enum
{
    POLICY_OFF = 0,
    POLICY_SWING_UP = 1,
    POLICY_LQR = 2,
    POLICY_FAILED = 3,
    POLICY_RECENTER = 4
};
enum
{
    POLICY_OK = 0,
    POLICY_LOG_DOMAIN = 1,
    POLICY_BALANCE_LOST = 2,
    POLICY_NUMERIC = 3,
    POLICY_TRACK_LIMIT = 4
};
typedef struct
{
    uint16_t id;
    const char *name;
} policy_descriptor_t;
typedef struct
{
    uint16_t id;
    uint8_t phase, error;
    bool running, measurement_initialized;
    uint8_t velocity_samples;
    uint32_t recovery_count;
    uint64_t started_us, last_control_us, last_measurement_us, far_since_us;
    float last_angle, history[5], filtered_velocity;
    float integral, raw_acceleration, applied_acceleration, energy, energy_fraction,
        energy_threshold;
    float elapsed_s, sample_dt;
} policy_t;

const policy_descriptor_t *policy_descriptor(uint16_t index);
uint16_t policy_count(void);
void policy_init(policy_t *p, uint16_t id);
void policy_start(policy_t *p, uint64_t now_us);
void policy_stop(policy_t *p);
/* Inputs match the Due law: millimetres, mm/s, radians. Output is mm/s².
 * Returns true only when a fresh 100 Hz control update has occurred. */
bool policy_update(policy_t *p, uint64_t now_us, float x_mm, float v_mm_s, float angle);
float legacy_energy(float angle, float angular_velocity);
float legacy_lqr(float x, float v, float angle, float angular_velocity, float integral);
float legacy_swing_up(float x, float v, float angle, float angular_velocity, float elapsed_s);
#endif
