# USB serial protocol and browser interface — v1

Status: v1 implemented for on-device simulation, with a native C test peer and a
local WebSocket console. Physical sensor acquisition and motor actuation are not
implemented. This document also defines the later sensing/manual-motion behavior.

The current firmware always advertises simulation mode and leaves physical
STEP/DIR/ENABLE pins unconfigured. No serial command can select physical motion.

## 1. End-to-end path

```text
Browser ← WebSocket JSON → Computer server ← binary serial → STM32
                               │                           │
                         owns serial port           owns real-time motion
```

The server runs on the computer plugged into CN1. ST-LINK exposes a virtual COM
port bridged to USART3 (PD8 TX / PD9 RX); firmware must initialize that UART.
No native USB stack or second USB cable is needed. This routing is documented in
[ST UM1974, section 7.9](https://www.st.com/resource/en/user_manual/um1974-stm32-nucleo144-boards-mb1137-stmicroelectronics.pdf).

Use 115200 baud, 8 data bits, no parity, 1 stop bit, no flow control. Select the
serial device by explicit user choice or saved USB identity; do not automatically
open arbitrary serial devices. One server owns the port. The browser connects to
that server's `/ws` endpoint; it does not use Web Serial.

Initial server: TypeScript/Node.js, serving the React/TypeScript frontend and
bridging serial. Bind to localhost by default, validate WebSocket Origin against
the served UI, and require explicit configuration/authentication before allowing
remote motion control. Firmware remains authoritative over motion limits.

## 2. Units and meaning

- Device time: unsigned 64-bit monotonic microseconds since MCU boot. Plot sample
  time, not WebSocket arrival time. Reset chart continuity on a new boot/session.
- Pendulum angle: radians, upright = 0, wrapped into `[-π, π)`. Positive angle is
  clockwise when viewed from the sensor side; verify/set calibration sign once
  installed. Differentiate with wrap handling before filtering angular velocity.
- Stepper position: signed 64-bit **emitted STEP pulse count**, relative to a
  software origin. One pulse means one configured microstep, not one full step.
- Velocity: pulses/s. Acceleration: pulses/s². Positive direction is cart right
  when viewed from the operator side. Firmware configuration maps this to DIR.
- Position, velocity, and acceleration are pulse-derived/commanded quantities;
  they do not measure actual rotor/cart motion or detect missed steps. The UI
  must label this explicitly. Physical mm/mm/s/mm/s² require calibrated mechanics
  and microstep configuration; do not silently guess that conversion.
- Changing microstep DIP settings invalidates motion calibration and requires
  disarm, a configuration update, and re-establishing the position reference.

## 3. Serial framing

Each frame is `COBS(header || payload || crc32) || 0x00`. COBS removes zero bytes
inside frames; `0x00` is the delimiter and recovery point. Multi-byte integers
and IEEE-754 binary32 floats are little-endian. Serialize fields explicitly;
never transmit compiler-padded C structs. Reject NaN and infinity in commands.

Decoded header (16 bytes):

| Offset | Type | Field |
|---|---|---|
| 0 | u8 | Protocol version: 1 |
| 1 | u8 | Message type |
| 2 | u16 | Payload byte length |
| 4 | u32 | Sender message ID |
| 8 | u64 | Session ID; zero only for initial HELLO request |

Append a u32 CRC-32/ISO-HDLC over header and payload, excluding the CRC itself.
Parameters: polynomial `0x04C11DB7` (reflected implementation `0xEDB88320`),
init `0xFFFFFFFF`, reflect input/output, xorout `0xFFFFFFFF`;
check value for ASCII `123456789` is `0xCBF43926`. Write CRC little-endian.

Maximum decoded frame is 256 bytes, including header and CRC; maximum payload
236 bytes. Allocate at most 259 bytes for a COBS frame including delimiter.
An oversize frame is discarded through its next delimiter. Discard an incomplete
frame after 100 ms without a delimiter; UART overrun also discards through the
next delimiter. Flush a delimiter on host open before HELLO.

Validate COBS, version, exact length, CRC, type, session, and command payload
before dispatch. Bad framing/CRC gets no reply; count errors. Valid but unsupported
types or invalid command fields get a rejected response. No free-form text may
be interleaved on this UART. Diagnostics are framed messages or use SWO.

## 4. Sessions, acknowledgments, and stale data

HELLO payload is a freshly generated nonzero u64 `requested_session_id`. Host
generates a random value on every serial open/reconnect. The initial header's
session is zero. HELLO does not arm the motor. Accept a new session only in
IDLE or FAULT with motion stopped/disabled; reject takeover during motion or
while ARMED. Repeat HELLO with the same request ID/payload may return the same
HELLO_INFO without resetting state.

HELLO_INFO echoes the requested session in its header. Thereafter both peers use
that session on every packet. Reject packets from another session. A reboot
clears the session, starts disabled, and requires HELLO again. The bridge flushes
old RX/TX queues and chart state on reconnect; commands are never replayed.

Each sender assigns monotonically increasing message IDs, starting at 1 per
session, across its own message types. Start a new session before u32 exhaustion;
do not wrap IDs. HELLO uses host ID 1. Replies carry their own device message ID
and include the original host request ID in the payload. Telemetry message ID
gaps alone do not prove sample loss because responses share this counter.

Process host requests in order. Cache the last 16 request IDs, payload fingerprints,
and responses. An exact duplicate returns its original response without executing
again or renewing motion authority. A reused ID with a different payload is
rejected. An older ID outside the cache is rejected as stale. Use one serial
writer and a small bounded command queue in the bridge; never queue old jog targets.

ACK means the STM32 validated and accepted a request, not that the cart reached
a physical state. Telemetry reports applied state. Respond within 100 ms under
normal load. Host times out after 250 ms, reports an uncertain result, stops jog
refreshes and attempts STOP; it must not retry nonzero motion or ARM automatically.
Queries may be retried with the same ID. STOP/DISARM are safe to send again with
new IDs. The device lease protects against an unavailable link.

## 5. Message types and payloads

All offsets below are payload-relative. Every request gets RESPONSE, except
HELLO / GET_CONFIG → HELLO_INFO, GET_STATUS → STATUS, and
SIM_GET_PARAMETERS → SIM_PARAMETERS, and the catalog/status/subscription queries
described in sections 5.2–5.4. Unknown types get RESPONSE with
`UNSUPPORTED`. No response is sent to responses or unsolicited telemetry/events.

| ID | Direction | Name | Payload |
|---|---|---|---|
| 0x01 | Host → MCU | HELLO | u64 requested_session_id |
| 0x02 | MCU → host | HELLO_INFO | Layout below; also returned for GET_CONFIG |
| 0x03 | Host → MCU | GET_STATUS | Empty |
| 0x04 | MCU → host | STATUS | u32 request_id + 64-byte telemetry snapshot |
| 0x05 | MCU → host | RESPONSE | u32 request_id, u16 result, u8 state, u8 mode |
| 0x10 | Host → MCU | SET_TELEMETRY | u16 rate_hz; allowed 0, 10, 25, 50 |
| 0x11 | Host → MCU | ARM_MANUAL | Empty; permitted only from IDLE with valid limits |
| 0x12 | Host → MCU | SET_VELOCITY | f32 signed_target_pulses_s |
| 0x13 | Host → MCU | STOP | Empty; ramp to zero, retain ARMED if manual authority is active |
| 0x14 | Host → MCU | DISARM | Empty; immediate pulse inhibit and disable, return IDLE |
| 0x15 | Host → MCU | CLEAR_FAULT | Empty; only if underlying cause cleared and stationary |
| 0x16 | Host → MCU | ZERO_POSITION | Empty; only in IDLE with motion disabled |
| 0x17 | Host → MCU | KEEPALIVE | Empty; sustain stationary ARMED or a running policy |
| 0x18 | Host → MCU | SET_ACCELERATION | f32 pulses/s²; stationary IDLE/ARMED, 50..500000 |
| 0x19 | Host → MCU | GET_CONFIG | Empty; returns current HELLO_INFO layout |
| 0x20 | MCU → host | TELEMETRY | 64-byte snapshot below |
| 0x21 | MCU → host | EVENT | u64 time_us, u16 code, u8 state, u8 mode, u32 faults |
| 0x30 | Host → MCU | SIM_RESET | Empty; reset simulated state, IDLE only |
| 0x31 | Host → MCU | SIM_SET_STATE | 24-byte initial state below, IDLE only |
| 0x32 | Host → MCU | SIM_PAUSE | u8 paused (0 or 1), IDLE only |
| 0x33 | Host → MCU | SIM_SET_PARAMETERS | f32 pivot inertia (kg·m²), f32 viscous damping (N·m·s/rad) |
| 0x34 | Host → MCU | SIM_GET_PARAMETERS | Empty; returns SIM_PARAMETERS |
| 0x35 | MCU → host | SIM_PARAMETERS | 28-byte parameter response below |

No physical position/acceleration move command is exposed in v1. The simulation
allows a bounded acceleration/deceleration ramp setting while stationary, rather
than an instantaneous acceleration command. It applies equally to ramping up and
stopping. Speed bounds remain fixed. Telemetry rate changes and zeroing are
IDLE-only. Physical-limit/calibration editing and closed-loop commands require
a later protocol extension, not undocumented fields.

HELLO_INFO payload (48 bytes):

| Offset | Type | Field |
|---|---|---|
| 0 | u32 | request_id |
| 4 | u16 | board_id: 1 = NUCLEO-F767ZI |
| 6 | u16 | capability bits: bit0 angle, bit1 manual jog, bit2 pulse count, bit3 simulation, bit4 policies, bit5 selectable telemetry, bit6 structured logging |
| 8 | u32 | firmware version: major<<16 \| minor<<8 \| patch |
| 12 | u32 | control period, µs; target 1000 |
| 16 | f32 | maximum permitted absolute velocity, pulses/s |
| 20 | f32 | configured acceleration limit, pulses/s² |
| 24 | f32 | configured stop deceleration, pulses/s² |
| 28 | u32 | configured STEP pulses per motor revolution; 0 = unknown |
| 32 | f32 | mm per pulse; 0 = uncalibrated |
| 36 | u16 | manual lease_ms: 500 |
| 38 | u16 | maximum telemetry rate_hz: 50 |
| 40 | u32 | motion configuration revision |
| 44 | u32 | reserved = 0 |

Do not advertise manual jog capability until electrical checks and conservative
motion limits are configured. Disabled/unimplemented capabilities return
`UNSUPPORTED`; HELLO_INFO can advertise angle-only sensing first. Values must be
finite; ARM requires positive velocity/acceleration/deceleration limits. Absolute
values remain bench configuration decisions, not invented protocol defaults.

Result codes: 0 OK, 1 UNSUPPORTED, 2 BAD_PAYLOAD, 3 WRONG_STATE, 4 LIMIT_EXCEEDED,
5 FAULT_ACTIVE, 6 BAD_SESSION, 7 STALE_REQUEST, 8 ID_REUSE, 9 BUSY, 10 NOT_CONFIGURED.
For BAD_SESSION, echo the request's session in the rejection header without
adopting it; host treats this only as rejection, never confirmation of a session.

State values: 0 BOOT, 1 IDLE, 2 ARMED, 3 RUNNING, 4 STOPPING, 5 FAULT.
Mode values: 0 NONE, 1 MANUAL_VELOCITY, 2 SIMULATION. Other values are reserved.
Fault bits: 0 hardware stop, 1 travel limit, 2 invalid sensor, 3 motion timing
failure, 4 control overrun, 5 command lease expired, 6 communications overflow, 7 policy failure.
An unknown state/fault must remain visible in the host, not be treated as safe.
Event codes: 1 state changed, 2 fault asserted, 3 fault cleared, 4 position zeroed,
5 simulation state reset/set, 6 simulation pause/resume changed.
Events are best effort; current faults/state are repeated in telemetry.

### 5.1 Simulation-only extension

Capability bit3 and mode 2 identify simulated physics running on the MCU. All
motion telemetry is then simulated, including pulse counts and driver-enable
state. Physical STEP/DIR/ENABLE outputs stay unconfigured in this implementation.
Future hardware firmware must reject simulation setter types unless simulation is enabled.

SIM_SET_STATE payload (24 bytes):

| Offset | Type | Field |
|---|---|---|
| 0 | f32 | angle_rad, -π..π |
| 4 | f32 | angular_velocity_rad_s, -50..50 |
| 8 | i64 | step_position_pulses, -9500..9500 (−190..+190 mm) |
| 16 | f32 | step_velocity_pulses_s, within advertised velocity limit |
| 20 | u8 | paused: 0 or 1 |
| 21 | 3 bytes | Reserved, all zero |

Reset and state replacement are IDLE-only. SIM_RESET sets angle 0.2 rad, zero
angular velocity, zero step position/velocity/acceleration/target, and resumes
physics. SIM_SET_STATE sets the four initial quantities and paused state; initial
step velocity becomes its free-running simulated target. It does not arm jog
authority. Applying a moving initial condition can therefore evolve a virtual
cart while the command state is IDLE; it never enables hardware. STOP/DISARM also
stop that virtual cart. Pausing freezes integration, not communications/timeouts.

Simulation state changes emit event 5 and start a new graph segment. Device time
remains monotonic. All simulation values are finite and range checked. The model
is a damped inverted pendulum driven by simulated cart acceleration, with no
balancing controller. Gravity is 9.81 m/s², pendulum mass is 0.094 kg, and its
center of mass is 0.1444 m from the pivot. Default pivot inertia is
0.00267683 kg·m² (legacy 2676.83 kg·mm²); default viscous damping is
0.0004015245 N·m·s/rad. Integration uses
`I*theta_ddot = m*l*(g*sin(theta) - cart_accel*cos(theta)) - b*theta_dot`.
Travel is 0.02 mm per pulse; max speed is 16000 pulses/s. Acceleration and stop
deceleration default to 500000 pulses/s² and are configurable together within
50..500000 pulses/s² (1..10000 mm/s²). Changes require stationary IDLE/ARMED,
increment the configuration revision, survive simulation reset/reconnect, and
return to defaults on MCU reboot. GET_CONFIG reads the current applied values;
the bridge refreshes these after a successful SET_ACCELERATION.

Motion defaults were recovered from commit `340351a` (the parent of the legacy
removal), in `inverted-pendulum-main-v2/lib/BiPolarStepper/BiPolarStepper.cpp`
and `inverted-pendulum-main-v2/src/main.cpp`. The original firmware version has
the same values: 200 full steps/rev × 8 microsteps = 1600 pulses/rev;
32 mm/rev = 0.02 mm/pulse; 62.83 rad/s ≈ 320 mm/s ≈ 16000 pulses/s; and
10000 mm/s² = 500000 pulses/s². The acceleration value was a limit in the old
code, not a measured motor capability or a separate manual-jog ramp setting.
The legacy ±190 mm software travel limit is enforced on simulated continuous
position, including fractional pulses. A hard stop removes outward velocity,
with no bounce; collision acceleration can exceed the motor ramp limit. Held
outward target velocity remains visible, but does not move the cart beyond the
stop. An inward target works immediately without clearing a fault or rearming.
Initial positions outside the track are rejected. Validate physical microstep
settings, travel, and capability separately before hardware actuation.

SIM_SET_PARAMETERS accepts pivot inertia 0.0001..0.1 kg·m² and viscous damping
0..0.05 N·m·s/rad. The cart must be stationary in IDLE or ARMED, with zero target.
Values are finite/range checked, applied together on the next model step, and
preserved through physics reset/serial reconnect; reboot restores defaults.
The request does not change the current pendulum state. The bridge reads parameters
on connect and after successful edits. New setters require the current firmware.

SIM_PARAMETERS payload (28 bytes):

| Offset | Type | Field |
|---|---|---|
| 0 | u32 | request_id |
| 4 | f32 | inertia_kg_m2, about the pivot |
| 8 | f32 | damping_n_m_s, viscous torque coefficient |
| 12 | f32 | mass_kg, currently 0.094 |
| 16 | f32 | center_of_mass_m, currently 0.1444 |
| 20 | f32 | x_min_mm, currently -190 |
| 24 | f32 | x_max_mm, currently +190 |

The native peer uses this same C implementation for automated checks.

### 5.2 Discoverable control policies

Capability bit4 advertises this extension. Policy IDs are stable compiled IDs;
catalog indices are for enumeration. See [control-policy.md](control-policy.md)
for provenance, equations, sampling, and live switching semantics.

| ID | Direction | Name | Payload |
|---|---|---|---|
| 0x40 | Host → MCU | LIST_POLICIES | u16 catalog index, starting at 0 |
| 0x41 | MCU → host | POLICY_DESCRIPTOR | u32 request_id, u16 count, u16 index, u16 policy_id, u8 name_length, u8 flags, name bytes |
| 0x42 | Host → MCU | GET_POLICY | Empty; returns POLICY_STATUS |
| 0x43 | Host → MCU | SELECT_POLICY | u16 policy_id; RESPONSE |
| 0x44 | Host → MCU | START_POLICY | Empty; RESPONSE |
| 0x45 | MCU → host | POLICY_STATUS | Layout below; query response or unsolicited 10 Hz |

Names are UTF-8 without a terminator. Descriptor flags: bit0 runnable policy,
bit1 live selection supported. Current entries: ID 0 `manual`, ID 1
`swingup_lqr_v1`, ID 2 `swingup_lqr_v2`, ID 3 `swingup_lqr_v3`. Unknown IDs are rejected without changing the selection.
Selection is permitted in IDLE/ARMED/RUNNING when fault-free, rejected in STOPPING.
In RUNNING it starts a fresh context while preserving plant state; selecting
Manual stops with the normal ramp. In IDLE/ARMED selection only configures the
next run. START_POLICY requires ARMED and a runnable selection. ARM (0x11)
provides authority for either manual motion or the selected policy.

POLICY_STATUS is 24 bytes:

| Offset | Type | Field |
|---|---|---|
| 0 | u32 | request_id, zero for unsolicited status |
| 4 | u16 | selected policy ID |
| 6 | u8 | phase: 0 OFF, 1 SWING_UP, 2 LQR, 3 FAILED, 4 RECENTER |
| 7 | u8 | bit0 running, bits1..7 error code (value shifted left one) |
| 8 | u32 | configuration revision |
| 12 | f32 | raw policy acceleration, mm/s² |
| 16 | f32 | filtered legacy angular velocity, rad/s |
| 20 | f32 | LQR position integral, mm·s |

Error codes: 0 none, 1 logarithm domain, 2 balance lost, 3 nonfinite output,
4 legacy travel limit. They also latch device fault bit7. STOP/DISARM end the
policy; heartbeat expiry and link/ownership loss inhibit it just as manual motion.
KEEPALIVE sustains autonomous execution but does not sustain an abandoned manual
nonzero target. Restarting a stopped/faulted policy requires operator commands; selection alone
in a stationary state never starts a controller. Recovery policy ID2 can switch
between LQR, SWING_UP, and RECENTER without stopping or re-arming after a fall;
its state machine is detailed in [recovery-policy.md](recovery-policy.md).

### 5.3 Selectable telemetry

Capability bit5 advertises a separate optional stream. The existing 64-byte
TELEMETRY snapshot and the four overview charts remain unchanged at 50 Hz.
Optional streaming starts disabled on each new serial session. The web overview
then explicitly requests its u-plot channels using `control_subscribe`; this is
separate from each browser's Telemetry lab choices. Query the MCU
catalog and current subscription, then request only the channels of interest.
IDs are stable within a schema version; consumers must discover metadata instead
of assuming numeric IDs or units.

| ID | Direction | Name | Payload |
|---|---|---|---|
| 0x50 | Host → MCU | TELEMETRY_CATALOG | u16 channel ID, enumerate from 0 to count−1 |
| 0x51 | MCU → host | TELEMETRY_DESCRIPTOR | Metadata layout below |
| 0x52 | Host → MCU | GET_SUBSCRIPTION | Empty; returns SUBSCRIPTION |
| 0x53 | MCU → host | SUBSCRIPTION | u32 request_id, u16 schema_version, u16 rate_hz, u32 channel_mask, u32 revision |
| 0x54 | Host → MCU | SUBSCRIBE | u32 channel_mask, u16 rate_hz, u16 reserved=0; returns SUBSCRIPTION |
| 0x55 | MCU → host | SELECTED_TELEMETRY | Sparse sample layout below |

Descriptor: u32 request_id at 0, u16 schema_version at 4, u16 channel_count at 6,
u16 channel_id at 8, u8 value_type at 10 (`1` = f32), u8 flags at 11 (reserved 0),
u8 name/unit/description byte lengths at 12/13/14, u8 reserved=0 at 15,
then concatenated UTF-8 name, unit, description without terminators.
Schema 1 contains 30 channels (IDs 0..29), including model state, policy outputs,
energy/threshold, position integral, filtered angular velocity, model parameters,
lease time, diagnostics, bounds, and device state. Names and units come from
`lib/telemetry/telemetry.c`.

SUBSCRIBE atomically replaces mask/rate in any device state and increments its
revision. Bit `i` requests channel `i`. Reject unknown bits, nonzero reserved,
or rates outside 0, 5, 10, 25 Hz without changing the previous subscription.
Zero rate or an empty mask disables emission. This is read-only diagnostics and
does not renew motion authority. GET_SUBSCRIPTION reads the device's actual setup.

SELECTED_TELEMETRY:

| Offset | Type | Field |
|---|---|---|
| 0 | u64 | device time, microseconds |
| 8 | u32 | optional sample sequence |
| 12 | u32 | channel mask |
| 16 | u32 | subscription revision |
| 20 | u16 | schema version |
| 22 | u16 | configured rate Hz |
| 24 | u32 | validity mask, using channel IDs as bits |
| 28 | f32[] | selected values in ascending channel ID order |

Length is `28 + 4 * popcount(mask)`. Only requested values are serialized.
An invalid/unavailable value has its validity bit cleared and a zero wire value;
the bridge maps it to JSON null and the graph shows a gap. Historical `legacy.*`
channels describe v1/v2 and shared controller signals. V3 marks the legacy energy,
fraction and threshold channels unavailable because its energy is normalized.
Channels 25..29 expose v3 estimated a, estimated c, excitation flag, completed
window count, and timed-out window count; they are unavailable for other policies. Channel 24
`controller.recovery_count` counts LQR recovery attempts (zero for the legacy law),
with the same availability. FAILED retains the
last diagnostic values. Diagnostic counts/enums use f32 in schema 1 and are
approximate above 2^24; existing exact position/time fields remain in base telemetry.

At all 30 channels/25 Hz the optional stream uses at most 170 UART bytes/sample,
or 4250 bytes/s. Add base telemetry (4300), policy status (460), and 20 Hz
keepalive responses (600): about 9610 bytes/s of 11520 transmit capacity, leaving
room for normal commands. Queues stay bounded and diagnostics may drop rather
than block control; target timing and throughput still require bench validation.

### Sampling rate and serial bandwidth

The selected-channel 25 Hz ceiling is a conservative firmware setting, not a USB
speed limit. The ST-LINK virtual COM connection currently uses a **115200 baud,
8N1 UART**: ten wire bits per byte gives **11520 bytes/s per direction**. USB does
not bypass that UART bottleneck.

For the overview's four-channel u subscription, each selected-telemetry sample
uses 66 framed bytes (44 payload + 20 header/CRC + 2 COBS/delimiter). Base state
telemetry uses 86 framed bytes at 50 Hz, or 4300 bytes/s. A budget including
10 Hz policy status (460 bytes/s), 20 Hz keepalive replies (600 bytes/s), and the
maximum 10 Hz log stream (540 bytes/s) is:

| u sample rate | u bytes/s | Combined transmit bytes/s | UART capacity |
| --- | ---: | ---: | ---: |
| 25 Hz (current) | 1650 | 7550 | 66% |
| 50 Hz (hypothetical) | 3300 | 9200 | 80% |
| 100 Hz (hypothetical) | 6600 | 12500 | 109% |

This excludes catalog/configuration replies and additional command replies.
Additional lab channels increase the single combined subscription's packet size;
the four overview channels are not transmitted twice. All 30 channels at 25 Hz,
with the same background traffic, use about 10150 bytes/s (88%).

A compact, batched 100 Hz u trace is a plausible future extension at this baud,
with one timestamp/header for multiple samples. Raising the existing packet rate
alone would exceed this budget. Higher UART baud rates need firmware/host changes
and bench verification. Native pipe/PTY simulation has no physical UART bottleneck,
but currently follows the same subscription limits. The present 25 Hz stream can
miss control changes between samples; it is not a full-rate recording of the
100 Hz v1/v2 or 1 kHz v3 policy. Changing its limit or adding batched samples is a separate protocol
change; no throughput increase is claimed here as a measured hardware result.

WebSocket commands (new monotonic request IDs as usual):

```json
{"v":1,"type":"select_policy","id":20,"policy_id":1}
{"v":1,"type":"start_policy","id":21}
{"v":1,"type":"get_telemetry_setup","id":22}
{"v":1,"type":"telemetry_subscribe","id":23,"channels":[0,8,10,11],"rate_hz":10}
```

Policy commands require control ownership. Any connected reader can query setup
and subscribe. On connect the bridge enumerates MCU policy/channel catalogs;
`get_telemetry_setup` rereads the current MCU subscription and returns cached
catalog metadata. `connection` includes `policies` and `policy`;
`policy_status` carries a `policy` object. `telemetry_setup` includes `catalog`,
MCU `subscription` (mask/rate/revision/schema), and that browser's `channels` and
`rate_hz`. `selected_telemetry` includes string `time_us`, `sample_seq`, `revision`,
`schema_version`, and a `values` object keyed by channel ID.

The bridge serializes subscription updates, requests the union of all browser
masks at their maximum rate, and filters/downsamples for each browser.
The overview sends `{"v":1,"type":"control_subscribe","id":24,"enabled":true}`
after connecting. This read-only subscription adds channels 6/7/13/14 (raw u,
limited u, phase, policy ID) at 25 Hz to the same MCU union. It does not modify that
browser's lab channel selection. `control_telemetry` contains `time_us`,
`sample_seq`, `rate_hz`, `active`, `policy_id`, `phase`, `raw_u_mm_s2`, and
`limited_u_mm_s2`. OFF/Manual/FAILED produce inactive/null command values so a
cached failure output cannot look like a still-active command. Stopping the lab
stream leaves the separately subscribed overview plot running. Browser close or
`control_subscribe` with `enabled:false` removes that subscription.
 Closing a
browser removes its subscription; reconnect starts with none. This permits
independent graphs without a second motion authority. The Telemetry lab page
renders a bounded history with gaps, while Overview retains its four plots.

### 5.4 Structured logging

Capability bit6 advertises framed logging and threshold control. Numeric telemetry
remains unchanged. No unframed diagnostic text may be written to this UART.

| ID | Direction | Name | Payload |
|---|---|---|---|
| 0x22 | MCU → host | LOG_RECORD | 32-byte record below, unsolicited |
| 0x60 | Host → MCU | GET_LOG_CONFIG | Empty; returns LOG_CONFIG |
| 0x61 | MCU → host | LOG_CONFIG | u32 request_id, u8 minimum_level, 3 zero reserved bytes, u32 dropped |
| 0x62 | Host → MCU | SET_LOG_LEVEL | u8 minimum_level; returns LOG_CONFIG |

Levels: 0 off, 10 debug, 20 info (boot default), 30 warn, 40 error. Reject other
values/lengths. Configuration persists through simulation reset and session
changes; reboot restores defaults. These queries/setters do not renew motion.

LOG_RECORD layout:

| Offset | Type | Field |
|---|---|---|
| 0 | u64 | device time, microseconds |
| 8 | u32 | log sequence; rate-limited/failed TX attempts create gaps |
| 12 | u8 | severity 10/20/30/40 |
| 13 | u8 | subsystem: 1 device, 2 policy, 3 simulation, 4 serial |
| 14 | u16 | event code |
| 16 | u32 | argument A |
| 20 | u32 | argument B |
| 24 | u32 | argument C |
| 28 | u32 | cumulative rate/TX drops, saturating |

Codes 1..6 correspond to existing EVENT codes (state changed, fault asserted,
fault cleared, position zeroed, simulation reset/set, pause changed): arguments
are current state, fault bits, paused flag. Code7 is policy selected (policy ID,
was-running flag, config revision). Code8 is policy phase changed (policy ID,
phase, error code). Code9 is configuration changed (command type, config revision,
zero). Code10 is serial session established (zero arguments). Code11 is command
rejected (command type, result code, host request ID). Unknown codes must preserve
their numeric ID and argument array in exported logs.

Firmware caps log attempts at ten transmitted records per one-second window,
without queues or allocation. Emission uses low-priority TX admission so logs
cannot consume the response reserve. A full TX buffer drops the log and increments
the counter; it does not create a communications fault. Events remain best effort
and latched faults are still reported independently in base telemetry. With all
30 optional channels at 25 Hz plus existing streams, ten 54-byte framed log
records/s bring typical maximum steady TX use to about 10150 of 11520 bytes/s;
command bursts can still drop diagnostics. Validate timing/throughput on hardware.

The bridge sends `log_history` (up to 50 retained entries on browser connection)
and live `log` messages. Each normalized entry has server `id`, UTC `timestamp`,
`level`, `source`, `message`, `fields`, and optional `session_id`/`device_time_us`.
The server retains at most 1000 entries in memory. `GET /api/logs` downloads its
current history as NDJSON. Server receive time and device sample time are distinct.

Browser command requests use
`{"v":1,"type":"console_command","id":123,"line":"status"}`. The server parses
one bounded command and routes it through the same ownership/validation path as
the existing controls. Optional `console_output` carries request `id` and `data`;
the normal `result` message gives success/rejection. `help` is available offline;
status/config/policy/log/telemetry queries are read-only. Mutation requires control
ownership. The browser cannot submit raw shell/JavaScript or serial bytes.
See [logging-and-console.md](logging-and-console.md) for grammar, timed-jog
semantics, retention limits, and planned CLI/TUI serial-sharing decisions.

## 6. Motion authority and jog semantics

1. Boot/reset starts with pulse output inhibited and driver disabled. HELLO and
   telemetry subscription never enable motion.
2. Operator explicitly arms. STM32 checks configuration, safety inputs, permitted
   state, and any required travel/reference checks. ARM enters ARMED, target zero,
   with the driver still disabled and a 500 ms lease. While not jogging, the
   frontend sends KEEPALIVE at 20 Hz to retain stationary arming. There is no
   fixed idle auto-disarm timeout while valid presence continues.
   ARM does not itself start pulses. On the first
   accepted nonzero target, enable the driver and respect its enable-to-step delay.
3. While a jog is held, the frontend sends intent at 20 Hz. Bridge immediately
   forwards each fresh intent as a new SET_VELOCITY request. Each accepted fresh
   request renews the fixed 500 ms device lease, including a zero target.
   KEEPALIVE renews in ARMED with target and velocity both zero, or during an
   autonomous policy; it cannot sustain a moving manual command. Telemetry, status/config queries, and duplicate
   requests never renew the lease.
4. Left sends `-abs(speed)`, right sends `+abs(speed)`. STM32 rejects nonfinite or
   over-limit requests; no silent clamping. It applies the configured acceleration
   ramp at its own 1 kHz update; browser timing does not schedule motor steps.
5. A nonzero accepted target enters RUNNING. A zero SET_VELOCITY ramps to zero
   and returns to ARMED, still under the same expiring lease.
6. On button/key release, send STOP immediately. A fresh velocity request can
   interrupt a normal STOPPING ramp while manual authority is valid and no fault
   is active. It replaces the target immediately; acceleration still governs
   reversal through zero velocity, with no wait for an intermediate idle state
   or return to zero position. Once stationary, return to
   ARMED with a fresh lease if manual authority remains active. The next jog
   requires a new press, but does not require another ARM. STOP from an unarmed
   simulated initial condition remains IDLE. DISARM explicitly exits manual mode.
7. On lease expiry in ARMED or RUNNING enter
   STOPPING with target zero, reject
   motion requests, apply configured stop deceleration, disable, then latch
   FAULT with `command lease expired`. Clearing the fault returns IDLE and does
   not rearm. The maximum stopping distance includes both the 500 ms lease and
   the configured deceleration; it must fit available travel.
8. DISARM immediately stops pulse generation, disables the driver, and clears the
   target without a ramp. It is a software action and does not replace a hardware
   stop. Hardware stop, travel-limit violation, or timing failure immediately
   inhibits pulses and latches FAULT; mechanical coasting is still possible.
9. To reverse direction, decelerate to zero, finish the last pulse, satisfy the
   driver's DIR hold/setup timing, then accelerate in the other direction. Do not
   switch DIR under a live pulse train.

The bridge grants a single browser connection control ownership; all others are
read-only. Ownership acquisition is explicit and never arms automatically.
Release, WebSocket close, browser silence, or serial failure revokes ownership
and clears queued jog intent. The bridge's intent deadline is 150 ms: on expiry
send DISARM once, stop refreshing, and require a new press plus explicit arm.
Stationary ownership also requires a fresh browser presence message within
150 ms; do not synthesize MCU heartbeats from a cached browser state. Browser
focus/visibility loss explicitly disarms. A normal jog release only stops, keeping
the session armed while fresh presence messages continue.
Do not keep synthesizing serial refreshes from the last browser intent.
All ingress queues are bounded; reject rate abuse, drop superseded jog targets,
and prioritize STOP/DISARM over queued motion. Fault-induced STOPPING cannot be
interrupted by a jog. Reconnect starts with no owner and no held controls.

## 7. Telemetry payload (64 bytes)

| Offset | Type | Field |
|---|---|---|
| 0 | u64 | time_us at snapshot acquisition |
| 8 | u32 | sample_seq, increment each scheduled telemetry sample, wraps modulo 2³² |
| 12 | u32 | validity/status flags |
| 16 | i64 | step_position_pulses |
| 24 | f32 | angle_rad |
| 28 | f32 | angular_velocity_rad_s |
| 32 | f32 | step_velocity_pulses_s, applied pulse-rate estimate with sign |
| 36 | f32 | step_acceleration_pulses_s2, applied ramp derivative |
| 40 | f32 | target_velocity_pulses_s, accepted target before ramp |
| 44 | u16 | angle_adc_raw, 0..4095 for initial 12-bit ADC |
| 46 | u8 | operating state |
| 47 | u8 | mode |
| 48 | u32 | latched fault bits |
| 52 | u32 | telemetry snapshots dropped before TX since boot, saturating |
| 56 | u32 | most recent control/motion update execution time, µs; currently 0 (not instrumented) |
| 60 | f32 | actual unsigned STEP pulse rate, pulses/s |

Flag bits: 0 angle calibrated/valid, 1 angular velocity valid, 2 pulse position
valid relative to origin, 3 driver logically enabled, 4 physical position
referenced/homed, 5 motion quantities valid, 6 simulation paused, 7 left end stop,
8 right end stop. Other bits zero. End-stop flags compare the continuous simulated
position, including its fractional-pulse remainder. Unavailable numeric
fields are zero with validity bits clear; never graph those zeros as measurements.
Position is still pulse-derived when the referenced bit is set. Reset/reboot or
a motion discontinuity can invalidate the reference; ZERO_POSITION establishes
only a software origin and does not assert the physical-reference flag.

Acquire a coherent snapshot on the STM32; host must not reconstruct acceleration
by differentiating delayed network packets. Increment pulse position on emitted
active STEP edges, not on requested timer updates. Use sufficiently precise
counting even at the maximum configured pulse rate. Sensor saturation/diagnostics
must distinguish valid angle wrap endpoints from a disconnected sensor; a single
rail voltage is not by itself proof of disconnection for a full-range sensor.

Default telemetry is 50 Hz (one sample each 20 ms). An 84-byte decoded telemetry
frame occupies at most 86 UART bytes including COBS/delimiter: 4300 bytes/s at
50 Hz, about 37.3% of the 11520 bytes/s available with 115200 baud 8N1. Leave
remaining capacity for replies/events; cap diagnostics and drop old telemetry
instead of blocking control. UART RX uses a bounded ring; TX uses bounded queues
with responses/events ahead of telemetry. Report gaps and parser/queue errors.
An RX overflow while armed is a communications fault, not silent motion renewal.

DMA is optional for bring-up. On the F767, do not place DMA buffers in the
currently used DTCM region. If enabling DMA/cache later, use DMA-accessible SRAM
and explicit cache coherency/alignment rules; do not assume the current linker
data section is suitable.

## 8. WebSocket JSON interface

One JSON object per WebSocket message, schema version `v: 1`. Reject unknown
commands, invalid types/ranges, oversized messages (>4096 bytes), and nonfinite
numeric input. Browser request `id` is scoped to its connection; the bridge maps
it to a separate serial request ID. Only the owner may issue control commands.

Browser examples:

```json
{"v":1,"type":"acquire_control","id":1}
{"v":1,"type":"arm","id":2}
{"v":1,"type":"jog","id":3,"velocity_pulses_s":-200}
{"v":1,"type":"stop","id":4}
{"v":1,"type":"disarm","id":5}
{"v":1,"type":"clear_fault","id":6}
{"v":1,"type":"zero_position","id":7}
{"v":1,"type":"release_control","id":8}
{"v":1,"type":"sim_reset","id":9}
{"v":1,"type":"sim_state","id":10,"angle_rad":0.2,"angular_velocity_rad_s":0,"position_pulses":"0","velocity_pulses_s":0,"paused":true}
{"v":1,"type":"sim_pause","id":11,"paused":false}
{"v":1,"type":"keepalive","id":12}
{"v":1,"type":"set_acceleration","id":13,"acceleration_pulses_s2":500000}
{"v":1,"type":"sim_parameters","id":14,"inertia_kg_m2":0.00267683,"damping_n_m_s":0.0004015245}
```

The jog speed in the example is illustrative, not a configured safe default.
Connection management adds `connect` with a `path` chosen from `GET /api/ports`,
and owner-only `disconnect`. A failed connection reports a result and remains
disconnected. Connection results carry the device capabilities. The test-only
`native-simulation` port is exposed only when the server starts with `--mock`.
Frontend maintains a monotonically increasing request ID and sends a new jog
message every 50 ms only while held, or a keepalive every 50 ms while stationary
and controlling the device. Bridge rejects nonincreasing IDs. Release
control first requests DISARM and revokes ownership; a new owner cannot arm until
the MCU is stopped/IDLE. Arm, stop, and other serial-backed commands return a
final result only after the corresponding MCU response. Bridge-only ownership
results are explicitly marked with `source: "bridge"`.

Server examples:

```json
{"v":1,"type":"result","id":2,"source":"stm32","ok":true,"state":"ARMED"}
{"v":1,"type":"result","id":3,"source":"stm32","ok":false,"code":"LIMIT_EXCEEDED"}
{"v":1,"type":"connection","serial":"connected","session_id":"a4b08a15fd761029","control":"owned"}
{"v":1,"type":"telemetry","session_id":"a4b08a15fd761029","sample_seq":50,"time_us":"1000000","angle_rad":0.12,"step_position_pulses":"-120","step_velocity_pulses_s":-200,"step_acceleration_pulses_s2":0,"target_velocity_pulses_s":-200,"state":"RUNNING","mode":"MANUAL_VELOCITY","faults":[],"position_source":"pulse_count","physical_reference_valid":false,"dropped_samples":0}
```

Session IDs are fixed-width 16-digit hex strings; u64 timestamps and i64 pulse
positions are decimal strings to avoid JavaScript number precision loss. Invalid
measurements become JSON `null`, with validity flags included. Include all wire
telemetry fields in the actual JSON mapping, using the same names/units; examples
omit some fields for readability. Bridge also sends capabilities/limits from
HELLO_INFO, connection/state/fault events, ownership changes, and parser error
counters. Raw unknown fault bits are preserved alongside decoded names.
Connection status includes `simulation_runner` (`stm32`, `native-pipe`, or
`native-pty`) to label local runs separately from on-device simulation. `just
web-sim` uses a managed OS PTY through the real SerialPort path; see
[local-simulation.md](local-simulation.md). Connection status also includes `simulation_parameters` with the six model/bounds
values from SIM_PARAMETERS. Telemetry includes `at_left_bound`/`at_right_bound`.

Keep receive time separately for freshness checks. Mark telemetry stale after
250 ms without a sample at the default 50 Hz; clear jog, request STOP, and prevent
new arming until a healthy stream returns. A slow browser gets bounded buffering
and discarded old samples, not unlimited latency; revoke control if its socket
is backlogged. The MCU lease remains necessary even with these host checks.

## 9. Frontend behavior

- Four aligned state time-series plots: angle (display degrees, retain radians), step
  position (pulses), velocity (pulses/s), acceleration (pulses/s²). Show target and
  applied velocity as separate traces. Display “pulse-derived, not encoder
  feedback” by the stepper plots. Show gaps instead of connecting missing data.
- Separate overview **Raw control effort · u** and **Limited control effort · u**
  charts plot controller output in mm/s² with solid traces and independent vertical
  scales. They match when the ±10,000 mm/s² acceleration clamp is inactive. They
  use 25 Hz samples of the controller (100 Hz for v1/v2, 1 kHz for v3), with step traces and visible gaps when inactive. This is
  not a full-rate controller trace and can miss changes between samples. The
  limited command is before motor-speed saturation and is distinct from the
  simulator's 1 ms cart acceleration. The existing four state charts stay intact.
- Angle graph selector: upright = 0°, bottom = 0°, horizontal = 0° with upright
  at +90°, absolute angle from upright, or cos(θ). Absolute angle is
  `abs(wrap_degrees(theta * 180 / pi))`, continuously folded into 0..180° with
  equal left/right tilt values and no downward wrap jump.
  Upright/bottom signed degree displays are clockwise-positive;
  horizontal uses right-horizontal zero and counterclockwise-positive angles.
  Signed degree displays wrap to [-180,180), breaking trace segments at wrap.
  Cosine is +1 upright/−1 downward and intentionally loses tilt direction.
  Default axes are ±180° (signed), 0..180° (absolute), or ±1 (cosine), with optional auto-scale. This changes only the
  graph, not firmware coordinates, the animation, or controller inputs.
- Large apparatus animation above the plots maps the enforced track bounds to
  labeled end stops and an origin marker. It shows current cart position in mm
  and end-stop status. The C model enforces bounds independently of drawing.
- Use device-relative time and a bounded 30 s live buffer; redraw at up to
  30 frames/s independently of telemetry acquisition. Start a new segment after
  reset/reconnect. Optional later recording may retain more data on the server.
- Nonnegative speed setting bounded by device-advertised maximum. No motion
  merely from editing it. Changes while held take effect on the next fresh jog.
- Explicit Arm, Stop, Disarm, Clear Fault, and Zero Position controls, enabled
  only in allowed states. Label Stop as a ramped stop and Disarm as immediate
  pulse disable. Display MCU-confirmed state rather than assuming success.
- Editable acceleration/deceleration in mm/s², 1..10000 for the current simulation.
  Convert through the advertised mm/pulse value and round to whole pulses/s² to
  avoid floating-point conversion pushing the upper endpoint above its bound.
  Apply only while stationary and show the device-confirmed setting.
- Hold Left/Right buttons with pointer capture; stop on pointerup,
  pointercancel, lost capture, release, focus loss, or hidden page.
- ArrowLeft/ArrowRight use the same intent path. Ignore key repeat; maintain
  pressed state and run the 20 Hz refresh separately. Ignore shortcuts in text,
  number, select, or editable controls. Prevent page scrolling only when handling
  a valid jog. Most recently pressed arrow wins; releasing it restores the other
  if still held. Fresh arrows work during normal stop/reversal ramps. Space
  requests Stop when outside editable controls.
- Visibility/focus/connection loss clears held state permanently. Returning to
  the page never resumes motion; require a new input and explicit rearm.
- Show serial connection, data age, control owner, calibration/reference status,
  motion limits, and latched faults. A UI software stop is not a physical E-stop.

## 10. Implementation order and acceptance

1. Shared portable C encoder/decoder definitions and matching TypeScript codec.
   Test golden frames/CRC, arbitrary serial read fragmentation, concatenated
   frames, corrupt bytes, oversized lengths, timeouts, and delimiter recovery.
2. USART3 HELLO/GET_STATUS and angle-only telemetry through ST-LINK; no motion
   capability advertised until ready. Verify host discovery and reconnect.
3. Computer serial bridge, read-only WebSocket telemetry, and four plots; show
   unavailable motion fields as null until motion support exists.
4. Bench-verified pulse generation, emitted-edge counting, acceleration ramps,
   direction timing, conservative travel/speed limits, and disabled boot state.
5. Arm/jog/stop and frontend pointer/keyboard controls with a single owner.
   Verify duplicate requests never repeat side effects or renew the lease.
6. Disconnect browser, kill server, unplug USB, freeze frontend refresh, reset
   MCU, corrupt/overflow serial input, and switch owners. Verify stopping and
   reference/fault behavior without automatic rearming or stale-command replay.
7. Verify telemetry throughput and bounded queues under slow-client load while
   measuring the real-time update and STEP timing. Debug halts require separate
   timer freeze/disable policy before powered-motion debugging.

The ESP32 may later implement the same logical messages over SPI. SPI framing,
bandwidth, and ownership handoff must be specified before enabling that transport;
it must not introduce a second concurrent motion authority.
