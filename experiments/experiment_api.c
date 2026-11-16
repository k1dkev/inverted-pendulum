/* Versioned scalar/buffer ABI: no policy or simulator struct crosses the boundary. */
#include "scenario.h"
#include <math.h>
#include <stddef.h>
#include <stdint.h>
#define COLUMNS 11U
typedef struct
{
    double *rows;
    size_t capacity, count;
    uint64_t stride_us;
} trace_t;
static void record(const scenario_sample_t *s, void *context)
{
    trace_t *t = context;
    if (s->time_us % t->stride_us || t->count >= t->capacity)
        return;
    double *row = t->rows + t->count++ * COLUMNS;
    row[0] = s->time_us / 1e6;
    row[1] = s->angle;
    row[2] = s->angular_velocity;
    row[3] = s->position_mm;
    row[4] = s->velocity_mm_s;
    row[5] = s->acceleration_mm_s2;
    row[6] = s->raw_control;
    row[7] = s->limited_control;
    row[8] = s->phase;
    row[9] = s->estimated_a;
    row[10] = s->estimated_c;
}
int pendulum_experiment_version(void) { return 1; }
/* Returns number of samples or a negative error. Metrics: capture and settled
 * seconds (NaN if absent), max |x|, recoveries, policy error, finite, final time. */
int pendulum_experiment_run(int policy, double angle, double omega, double x, double velocity,
                            double inertia, double damping, uint32_t steps, uint32_t stride,
                            uint32_t disturbance_step, double disturbance_angle,
                            double disturbance_omega, double *rows, size_t capacity,
                            double *metrics)
{
    if ((policy < 1 || policy > 3) || !isfinite(angle) || fabs(angle) > 3.141592653589793 ||
        !isfinite(omega) || fabs(omega) > 50 || !isfinite(x) || fabs(x) > 190 ||
        !isfinite(velocity) || fabs(velocity) > POLICY_MAX_VELOCITY_MM_S || !isfinite(inertia) ||
        inertia < SIM_MIN_INERTIA || inertia > SIM_MAX_INERTIA || !isfinite(damping) ||
        damping < 0 || damping > SIM_MAX_DAMPING || !steps || steps > 600000 || !stride ||
        stride > steps || !rows || !metrics || capacity < steps / stride ||
        disturbance_step > steps || !isfinite(disturbance_angle) ||
        fabs(disturbance_angle) > 3.141592653589793 || !isfinite(disturbance_omega) ||
        fabs(disturbance_omega) > 50)
        return -1;
    scenario_t s = {.name = "experiment",
                    .policy_id = (uint16_t)policy,
                    .initial_angle = (float)angle,
                    .initial_angular_velocity = (float)omega,
                    .initial_position_mm = (float)x,
                    .initial_velocity_mm_s = (float)velocity,
                    .model = {(float)inertia, (float)damping},
                    .duration_us = (uint64_t)steps * 1000,
                    .disturbance_us = (uint64_t)disturbance_step * 1000,
                    .disturbance_angle = (float)disturbance_angle,
                    .disturbance_angular_velocity = (float)disturbance_omega};
    trace_t trace = {rows, capacity, 0, (uint64_t)stride * 1000};
    scenario_result_t result = scenario_run(&s, record, &trace);
    metrics[0] = result.first_capture_us ? result.first_capture_us / 1e6 : NAN;
    metrics[1] = result.settled_us ? result.settled_us / 1e6 : NAN;
    metrics[2] = result.max_abs_position_mm;
    metrics[3] = result.recoveries;
    metrics[4] = result.final.error;
    metrics[5] = result.finite ? 1 : 0;
    metrics[6] = result.final.time_us / 1e6;
    return (int)trace.count;
}
