extern "C"
{
#include "policy.h"
}
#include <cassert>
#include <cmath>
#include <cstdio>
#include <initializer_list>

// Independent equations from main-v2 at 340351a, without Arduino IO.
// Class demo 6044f7ab:serial-read-test/calibration/calibration.ino has the same
// equations (Kw=-4749. and -4749.0 are equivalent).
namespace due
{
int sign(float v)
{
    if (v < 0)
        return -1;
    if (v == 0)
        return 0;
    return 1;
}
float pendE(float theta, float thetadot)
{
    float Ih = 2676.83, g = 9810.0, m = .094, L = 144.4;
    return 0.5 * Ih * pow(thetadot, 2) + m * g * L * cos(theta);
}
float swingUp(float x, float v, float theta, float thetadot, float swingDT)
{
    float ksu = 600.0, kcw = 1.37 * ksu, Lt = 150;
    float a = 0.65 + 0.1 / 25.0 * swingDT;
    float E = pendE(theta, thetadot), Eup = 133157.016;
    float Kx = 1.0, Kv = 1.5;
    if (E <= a * Eup)
        return -ksu * sign(thetadot * cos(theta)) + kcw * sign(x) * log(1 - std::abs(x) / Lt);
    return -(Kx * x + Kv * v);
}
float balanceLQR(float x, float v, float theta, float thetadot, float Ix)
{
    float Kx = -4.472, Kv = -5.621, Kt = -33492.0, Kw = -4749.0, Kix = -0.5;
    return -(Kx * x + Kv * v + Kt * theta + Kw * thetadot + Kix * Ix);
}
} // namespace due
static void near(float a, float b)
{
    assert(std::isfinite(a) && std::isfinite(b));
    assert(std::fabs(a - b) <= 1e-5f * std::fmax(1.f, std::fabs(b)));
}
int main()
{
    unsigned compared = 0;
    for (float x : {-149.f, -80.f, 0.f, 80.f, 149.f})
        for (float v : {-300.f, 0.f, 300.f})
            for (float theta : {-3.14f, -1.5f, -.05f, 0.f, .05f, 1.5f, 3.14f})
                for (float w : {-15.f, -1.f, 0.f, 1.f, 15.f})
                    for (float elapsed : {0.f, 25.f, 100.f})
                        for (float integral : {-20000.f, -42.f, 0.f, 42.f, 20000.f})
                        {
                            near(legacy_energy(theta, w), due::pendE(theta, w));
                            near(legacy_swing_up(x, v, theta, w, elapsed),
                                 due::swingUp(x, v, theta, w, elapsed));
                            near(legacy_lqr(x, v, theta, w, integral),
                                 due::balanceLQR(x, v, theta, w, integral));
                            ++compared;
                        }
    policy_t p;
    policy_init(&p, POLICY_LEGACY);
    policy_start(&p, 1000000);
    assert(!policy_update(&p, 1009999, 0, 0, 0));
    assert(policy_update(&p, 1010000, 0, 0, 0));
    assert(p.phase == POLICY_LQR); // angle-only handoff
    near(p.sample_dt, 1.01f);      // legacy first measurement is boot-relative
    near(p.filtered_velocity, -float(3.14159265358979323846) / 1.01f / 5);
    assert(policy_update(&p, 1020000, 10, 0, .01f));
    near(p.integral, .1f); // updated before computing LQR
    near(p.raw_acceleration, due::balanceLQR(10, 0, .01f, p.filtered_velocity, .1f));
    for (uint64_t t = 1030000; t <= 1520000; t += 10000)
        policy_update(&p, t, 0, 0, 1);
    assert(!p.running && p.error == POLICY_BALANCE_LOST && p.phase == POLICY_FAILED);
    policy_start(&p, 2000000);
    assert(p.integral == 0 && p.error == 0);
    policy_update(&p, 2010000, 151, 0, 3.14f);
    assert(!p.running && p.error == POLICY_LOG_DOMAIN);
    policy_start(&p, 3000000);
    policy_update(&p, 3010000, 190, 0, 0);
    assert(p.error == POLICY_TRACK_LIMIT);
    // Preserve the old encoder's unusual sum-at-wrap branch, not a corrected derivative.
    policy_start(&p, 4000000);
    policy_update(&p, 4010000, 0, 0, 3.f);
    float first = p.history[0];
    policy_update(&p, 4020000, 0, 0, -3.1f);
    near(p.history[0], (-3.1f + 3.f) / .01f);
    near(p.filtered_velocity, (p.history[0] + first) / 5);
    std::printf("Compared %u legacy state vectors; filter, handoff, integral and faults passed.\n",
                compared);
}
