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
#define SIM_BOUND_PULSES 9500LL /* ±190 mm at 0.02 mm/pulse. */
#define SIM_MASS_KG 0.094f
#define SIM_COM_M 0.1444f
#define SIM_DEFAULT_INERTIA 0.00267683f /* Legacy 2676.83 kg·mm², about the pivot. */
#define SIM_DEFAULT_DAMPING (SIM_DEFAULT_INERTIA * 0.15f)
#define SIM_MIN_INERTIA 0.0001f
#define SIM_MAX_INERTIA 0.1f
#define SIM_MAX_DAMPING 0.05f
typedef struct
{
    float inertia_kg_m2, damping_n_m_s;
} simulation_parameters_t;
typedef struct
{
    float angle, angular_velocity, velocity, acceleration, target;
    int64_t position;
    double fractional_position;
    bool paused, direct_velocity;
} simulation_t;
void simulation_reset(simulation_t *s);
void simulation_tick(simulation_t *s, float dt, float acceleration_limit,
                     const simulation_parameters_t *parameters);
float simulation_wrap(float angle);
#endif
