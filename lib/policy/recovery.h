#ifndef PENDULUM_RECOVERY_H
#define PENDULUM_RECOVERY_H
#include "policy.h"
void recovery_start(policy_t *p, uint64_t now_us);
void recovery_step(policy_t *p, uint64_t now_us, float x_mm, float velocity_mm_s, float angle);
#endif
