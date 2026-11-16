#include "scenario.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#define PI 3.14159265358979323846f
static void require(bool condition, const scenario_t *s, const char *message)
{
    if (!condition)
    {
        fprintf(stderr, "%s: %s\n", s->name, message);
        exit(1);
    }
}
static void count_samples(const scenario_sample_t *s, void *ctx)
{
    uint64_t *count = ctx;
    if (s->time_us != (*count + 1) * 1000)
    {
        fprintf(stderr, "non-monotonic scenario clock\n");
        exit(1);
    }
    ++*count;
}
int main(void)
{
    const scenario_t cases[] = {
        {"v2 downward",
         POLICY_RECOVERY,
         PI,
         0,
         0,
         0,
         {SIM_DEFAULT_INERTIA, SIM_DEFAULT_DAMPING},
         120000000,
         0,
         0,
         0},
        {"v3 downward",
         POLICY_V3,
         PI,
         0,
         0,
         0,
         {SIM_DEFAULT_INERTIA, SIM_DEFAULT_DAMPING},
         60000000,
         0,
         0,
         0},
        {"v3 offset start",
         POLICY_V3,
         1,
         0,
         100,
         0,
         {SIM_DEFAULT_INERTIA, SIM_DEFAULT_DAMPING},
         60000000,
         0,
         0,
         0},
        {"v3 disturbance",
         POLICY_V3,
         PI,
         0,
         0,
         0,
         {SIM_DEFAULT_INERTIA, SIM_DEFAULT_DAMPING},
         120000000,
         30000000,
         1,
         1},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); ++i)
    {
        const scenario_t *s = &cases[i];
        uint64_t samples = 0;
        scenario_result_t a = scenario_run(s, count_samples, &samples),
                          b = scenario_run(s, NULL, NULL);
        require(a.finite && !a.final.error, s, "nonfinite state or policy fault");
        require(a.max_abs_position_mm < 190, s, "exceeded policy track limit");
        require(a.first_capture_us && a.settled_us && a.final.phase == POLICY_LQR, s,
                "did not settle in LQR");
        require(samples == s->duration_us / 1000, s, "unexpected number of samples");
        if (s->disturbance_us)
            require(a.disturbance_applied && a.recoveries > 0 && a.final.phase == POLICY_LQR, s,
                    "did not recover from disturbance");
        require(a.first_capture_us == b.first_capture_us && a.settled_us == b.settled_us &&
                    a.final.angle == b.final.angle && a.final.position_mm == b.final.position_mm,
                s, "repeated run differed");
        printf("%s: capture %.3fs settled %.3fs max |x| %.2fmm\n", s->name,
               a.first_capture_us / 1e6, a.settled_us / 1e6, a.max_abs_position_mm);
    }
    scenario_t fault = {
        "track limit", POLICY_V3, PI, 0, 190, 0, {SIM_DEFAULT_INERTIA, SIM_DEFAULT_DAMPING},
        100000,        0,         0,  0};
    scenario_result_t stopped = scenario_run(&fault, NULL, NULL);
    require(stopped.final.error == POLICY_TRACK_LIMIT, &fault, "expected track limit fault");
    return 0;
}
