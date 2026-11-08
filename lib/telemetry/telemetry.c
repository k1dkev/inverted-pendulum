#include "telemetry.h"
static const telemetry_descriptor_t catalog[] = {
    {"angle", "rad", "Simulated pendulum angle, upright zero"},
    {"angular_velocity", "rad/s", "Simulated true angular velocity"},
    {"cart_position", "mm", "Continuous simulated cart position"},
    {"cart_velocity", "mm/s", "Applied simulated cart velocity"},
    {"cart_acceleration", "mm/s2", "Applied acceleration including hard stop impact"},
    {"target_velocity", "mm/s", "Requested velocity before actuator limits"},
    {"legacy.acceleration", "mm/s2", "Raw legacy policy output"},
    {"legacy.limited_acceleration", "mm/s2", "Legacy acceleration after its original limit"},
    {"legacy.energy", "kg*mm2/s2", "Original energy equation, original units"},
    {"legacy.energy_fraction", "1", "Time-varying energy target fraction"},
    {"legacy.energy_threshold", "kg*mm2/s2", "Fraction times original upright energy"},
    {"legacy.position_integral", "mm*s", "Integral used by legacy LQR"},
    {"legacy.elapsed", "s", "Time since policy start"},
    {"policy.phase", "enum", "0 off, 1 swing-up, 2 LQR, 3 failed"},
    {"policy.id", "enum", "Compiled policy identifier"},
    {"legacy.filtered_angular_velocity", "rad/s", "Original five-sample P3Encoder filter"},
    {"model.inertia", "kg*m2", "Pendulum pivot inertia"},
    {"model.damping", "N*m*s/rad", "Viscous pendulum damping coefficient"},
    {"lease_remaining", "ms", "Device command lease remaining"},
    {"serial.parse_errors", "count", "Rejected/incomplete serial frames"},
    {"telemetry.dropped", "count", "Telemetry frames dropped by bounded TX"},
    {"bounds.left", "bool", "Cart at the left hard stop"},
    {"bounds.right", "bool", "Cart at the right hard stop"},
    {"device.state", "enum", "Device operating state"}};
_Static_assert(sizeof(catalog) / sizeof(catalog[0]) == TELEMETRY_CHANNELS,
               "Catalog count mismatch");
const telemetry_descriptor_t *telemetry_descriptor(uint16_t id)
{
    return id < TELEMETRY_CHANNELS ? &catalog[id] : 0;
}
