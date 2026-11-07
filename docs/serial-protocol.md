# USB serial protocol and browser interface — v1

Status: design specification. The existing firmware is LED bring-up only. This
document defines the initial sensing/manual-motion milestone, not balancing.

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
HELLO → HELLO_INFO and GET_STATUS → STATUS. Unknown types get RESPONSE with
`UNSUPPORTED`. No response is sent to responses or unsolicited telemetry/events.

| ID | Direction | Name | Payload |
|---|---|---|---|
| 0x01 | Host → MCU | HELLO | u64 requested_session_id |
| 0x02 | MCU → host | HELLO_INFO | Layout below |
| 0x03 | Host → MCU | GET_STATUS | Empty |
| 0x04 | MCU → host | STATUS | u32 request_id + 64-byte telemetry snapshot |
| 0x05 | MCU → host | RESPONSE | u32 request_id, u16 result, u8 state, u8 mode |
| 0x10 | Host → MCU | SET_TELEMETRY | u16 rate_hz; allowed 0, 10, 25, 50 |
| 0x11 | Host → MCU | ARM_MANUAL | Empty; permitted only from IDLE with valid limits |
| 0x12 | Host → MCU | SET_VELOCITY | f32 signed_target_pulses_s |
| 0x13 | Host → MCU | STOP | Empty; ramp to zero, disable, return IDLE |
| 0x14 | Host → MCU | DISARM | Empty; immediate pulse inhibit and disable, return IDLE |
| 0x15 | Host → MCU | CLEAR_FAULT | Empty; only if underlying cause cleared and stationary |
| 0x16 | Host → MCU | ZERO_POSITION | Empty; only in IDLE with motion disabled |
| 0x20 | MCU → host | TELEMETRY | 64-byte snapshot below |
| 0x21 | MCU → host | EVENT | u64 time_us, u16 code, u8 state, u8 mode, u32 faults |

No position/acceleration move command is exposed in v1. Acceleration and speed
limits are firmware configuration, not arbitrary browser-supplied values.
Telemetry rate changes and zeroing are IDLE-only. Limit/calibration editing and
closed-loop commands require a later protocol extension, not undocumented fields.

HELLO_INFO payload (48 bytes):

| Offset | Type | Field |
|---|---|---|
| 0 | u32 | request_id |
| 4 | u16 | board_id: 1 = NUCLEO-F767ZI |
| 6 | u16 | capability bits: bit0 angle, bit1 manual jog, bit2 pulse count |
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
Mode values: 0 NONE, 1 MANUAL_VELOCITY. Other values are reserved.
Fault bits: 0 hardware stop, 1 travel limit, 2 invalid sensor, 3 motion timing
failure, 4 control overrun, 5 manual lease expired, 6 communications overflow.
An unknown state/fault must remain visible in the host, not be treated as safe.
Event codes: 1 state changed, 2 fault asserted, 3 fault cleared, 4 position zeroed.
Events are best effort; current faults/state are repeated in telemetry.

## 6. Motion authority and jog semantics

1. Boot/reset starts with pulse output inhibited and driver disabled. HELLO and
   telemetry subscription never enable motion.
2. Operator explicitly arms. STM32 checks configuration, safety inputs, permitted
   state, and any required travel/reference checks. ARM enters ARMED, target zero,
   with the driver still disabled. Allow 5 s for the first SET_VELOCITY; otherwise
   return to IDLE without a fault. ARM does not itself start pulses. On the first
   accepted nonzero target, enable the driver and respect its enable-to-step delay.
3. While a jog is held, the frontend sends intent at 20 Hz. Bridge immediately
   forwards each fresh intent as a new SET_VELOCITY request. Each accepted fresh
   request starts/renews the fixed 500 ms device lease, including a zero target. Ordinary
   telemetry, status requests, or duplicated packets do not renew it.
4. Left sends `-abs(speed)`, right sends `+abs(speed)`. STM32 rejects nonfinite or
   over-limit requests; no silent clamping. It applies the configured acceleration
   ramp at its own 1 kHz update; browser timing does not schedule motor steps.
5. A nonzero accepted target enters RUNNING. A zero SET_VELOCITY ramps to zero
   and returns to ARMED, still under the same expiring lease.
6. On button/key release, send STOP immediately. STOP cannot be undone by later
   velocity requests while STOPPING: reject them. Once stationary, disable and
   enter IDLE; the next jog needs explicit arming.
7. Once SET_VELOCITY has started the lease, on expiry in ARMED or RUNNING enter
   STOPPING with target zero, reject
   motion requests, apply configured stop deceleration, disable, then latch
   FAULT with `manual lease expired`. Clearing the fault returns IDLE and does
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
send STOP once, stop refreshing, and require a new press plus explicit arm after
stopping. Do not keep synthesizing serial refreshes from the last browser intent.
All ingress queues are bounded; reject rate abuse, drop superseded jog targets,
and prioritize STOP/DISARM over queued motion. A late request cannot restart a
STOPPING device. Reconnect starts with no owner and no held controls.

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
| 56 | u32 | most recent control/motion update execution time, µs |
| 60 | f32 | actual unsigned STEP pulse rate, pulses/s |

Flag bits: 0 angle calibrated/valid, 1 angular velocity valid, 2 pulse position
valid relative to origin, 3 driver logically enabled, 4 physical position
referenced/homed, 5 motion quantities valid. Other bits zero. Unavailable numeric
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
```

The jog speed in the example is illustrative, not a configured safe default.
Frontend maintains a monotonically increasing request ID and sends a new jog
message every 50 ms only while held. Bridge rejects nonincreasing IDs. Release
control first requests STOP and revokes ownership; a new owner cannot arm until
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

Keep receive time separately for freshness checks. Mark telemetry stale after
250 ms without a sample at the default 50 Hz; clear jog, request STOP, and prevent
new arming until a healthy stream returns. A slow browser gets bounded buffering
and discarded old samples, not unlimited latency; revoke control if its socket
is backlogged. The MCU lease remains necessary even with these host checks.

## 9. Frontend behavior

- Four aligned time-series plots: angle (display degrees, retain radians), step
  position (pulses), velocity (pulses/s), acceleration (pulses/s²). Show target and
  applied velocity as separate traces. Display “pulse-derived, not encoder
  feedback” by the stepper plots. Show gaps instead of connecting missing data.
- Use device-relative time and a bounded 30 s live buffer; redraw at up to
  30 frames/s independently of telemetry acquisition. Start a new segment after
  reset/reconnect. Optional later recording may retain more data on the server.
- Nonnegative speed setting bounded by device-advertised maximum. No motion
  merely from editing it. Changes while held take effect on the next fresh jog.
- Explicit Arm, Stop, Disarm, Clear Fault, and Zero Position controls, enabled
  only in allowed states. Label Stop as a ramped stop and Disarm as immediate
  pulse disable. Display MCU-confirmed state rather than assuming success.
- Hold Left/Right buttons with pointer capture; stop on pointerup,
  pointercancel, lost capture, release, focus loss, or hidden page.
- ArrowLeft/ArrowRight use the same intent path. Ignore key repeat; maintain
  pressed state and run the 20 Hz refresh separately. Ignore shortcuts in text,
  number, select, or editable controls. Prevent page scrolling only when handling
  a valid jog. Both directions held means stop and requires both released before
  another jog. Space requests Stop when outside editable controls.
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
