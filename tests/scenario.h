#ifndef PENDULUM_TEST_SCENARIO_H
#define PENDULUM_TEST_SCENARIO_H
#include "policy.h"
#include "simulation.h"
#include <stdint.h>

typedef struct
{
    const char *name;
    uint16_t policy_id;
    float initial_angle, initial_angular_velocity, initial_position_mm, initial_velocity_mm_s;
    simulation_parameters_t model;
    uint64_t duration_us, disturbance_us;
    float disturbance_angle, disturbance_angular_velocity;
} scenario_t;

typedef struct
{
    uint64_t time_us;
    float position_mm, velocity_mm_s, angle, angular_velocity, acceleration_mm_s2;
    float raw_control, limited_control;
    float estimated_a, estimated_c;
    uint8_t phase, error;
} scenario_sample_t;
typedef void (*scenario_observer_t)(const scenario_sample_t *, void *);
typedef struct
{
    scenario_sample_t final;
    uint64_t first_capture_us, settled_us;
    float max_abs_position_mm;
    uint32_t recoveries;
    bool finite, disturbance_applied;
} scenario_result_t;

/* Advances the real portable controller and simulated actuator at exactly 1 ms.
 * The observer is optional and is called after each physics step. */
scenario_result_t scenario_run(const scenario_t *, scenario_observer_t, void *);
#endif
