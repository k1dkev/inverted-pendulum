#ifndef PENDULUM_V3_H
#define PENDULUM_V3_H
#include "policy.h"
void v3_start(policy_t *p, uint64_t now);
void v3_step(policy_t *p, uint64_t now, float x, float v, float angle);
#endif
