#ifndef PENDULUM_TELEMETRY_H
#define PENDULUM_TELEMETRY_H
#include <stdint.h>
#define TELEMETRY_SCHEMA_VERSION 1U
#define TELEMETRY_CHANNELS 25U
#define TELEMETRY_VALID_MASK ((1U << TELEMETRY_CHANNELS) - 1U)
typedef struct
{
    const char *name, *unit, *description;
} telemetry_descriptor_t;
const telemetry_descriptor_t *telemetry_descriptor(uint16_t id);
#endif
