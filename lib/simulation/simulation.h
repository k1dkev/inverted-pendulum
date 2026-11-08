#ifndef PENDULUM_SIMULATION_H
#define PENDULUM_SIMULATION_H
#include <stdbool.h>
#include <stdint.h>
/* Legacy Due setup: 200 full steps/rev, 8x microstepping, 32 mm/rev.
 * These are simulation defaults, not validated physical-driver settings. */
#define SIM_PULSES_PER_REV 1600U
#define SIM_MM_PER_PULSE 0.02f
#define SIM_MAX_VELOCITY 16000.0f
#define SIM_MIN_ACCELERATION 50.0f
#define SIM_MAX_ACCELERATION 500000.0f
#define SIM_DEFAULT_ACCELERATION SIM_MAX_ACCELERATION
typedef struct
{
    float angle, angular_velocity, velocity, acceleration, target;
    int64_t position;
    double fractional_position;
    bool paused;
} simulation_t;
void simulation_reset(simulation_t *s);
void simulation_tick(simulation_t *s, float dt, float acceleration_limit);
float simulation_wrap(float angle);
#endif
