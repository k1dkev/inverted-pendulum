# Pendulum — Project Specification

**Version:** 0.3\
**Status:** Draft\
**Primary language:** C\
**Controllers:** STM32 initially; STM32 + ESP32 later\
**Build system:** CMake + Nix

## 1. Overview

Build an inverted pendulum system with real-time motor control, local and remote operator interfaces, telemetry, and a physics-based simulator.

The first iteration connects the STM32 to a computer over USB serial. A server on
that computer owns the serial connection and exposes a WebSocket interface to a
browser. This iteration provides angle and stepper telemetry plus manual velocity
jog controls; it does not require an ESP32 or implement balancing yet.

The eventual standalone system uses two microcontrollers with separate responsibilities:

- **STM32:** Real-time control, sensors, motor actuation, and safety.
- **ESP32:** Local user interface, networking, client communications, and configuration.

The eventual pendulum must be operable without a computer or network connection.

### 1.1 Project goals

- Establish sensing and safe manual motion on the existing NUCLEO-F767ZI.
- Plot pendulum angle and stepper position, velocity, and acceleration in a browser.
- Support a velocity setting, left/right hold buttons, and left/right arrow keys.
- Keep real-time pulse generation and motion limits on the STM32.
- Migrate to an STM32 Black Pill or a smaller STM32 Nucleo board after bring-up.
  The exact board/MCU remains undecided; select it against timer, ADC, memory,
  communications, and debugging needs. Isolate board pin assignments and startup
  code so the control and protocol code can carry over.
- Add closed-loop control and the ESP32 standalone interface in later iterations.

Detailed companion specifications:

- [NUCLEO-F767ZI pinout and wiring plan](stm32-pinout-plan.md)
- [USB serial protocol and browser interface](serial-protocol.md)

Control algorithms should remain portable across embedded firmware, native desktop applications, and WebAssembly.

## 2. System architecture

### 2.1 Initial computer-connected architecture

```text
Browser (React/TypeScript: charts, velocity setting, jog controls)
    ↕ WebSocket JSON
Computer server (TypeScript/Node.js: serial owner, protocol codec, control lease)
    ↕ USB cable to CN1 / ST-LINK virtual COM port
STM32 USART3 (PD8 TX, PD9 RX)
    ↕ ADC / timer / GPIO
Angle sensor / STEP-DIR driver / stepper motor
```

The browser initiates the WebSocket connection to the server. The browser does
not open the serial port; the server runs on the computer physically connected
to the board. Simulation remains a separate mode.

### 2.2 Eventual standalone architecture

```text
             Remote Clients
          Web UI / CLI / Python
                    |
             WebSocket / HTTP
                    |
                    v
    +--------------------------------+
    |             ESP32              |
    |                                |
    |  - WebSocket / HTTP server     |
    |  - Wi-Fi / Ethernet            |
    |  - Local screen                |
    |  - Buttons / rotary encoder    |
    |  - Configuration UI            |
    |  - Telemetry distribution      |
    +--------------------------------+
                    |
             SPI + GPIO handshake
                    |
                    v
    +--------------------------------+
    |             STM32              |
    |                                |
    |  - Real-time control loop      |
    |  - Sensor acquisition          |
    |  - State estimation            |
    |  - Stepper pulse generation    |
    |  - Motor safety and faults     |
    |  - Operating state machine     |
    +--------------------------------+
           |                 |
       ADC / SPI        TIM / GPIO
           |                 |
        Sensors        Stepper Driver
                             |
                         Stepper Motor

    Emergency Stop / Motor Disable
             |
      Independent hardware
      safety-disable path
```

The ESP32 is not involved in real-time control-loop scheduling.

The STM32 remains authoritative over operating state, motor commands, and safety decisions.

## 3. Hardware

### 3.1 STM32 controller

- NUCLEO-F767ZI development board (STM32F767ZIT6, Cortex-M7).
- ARM Cortex-M processor.
- STM32 HAL for peripheral access.
- Hardware timers for deterministic control timing.
- DMA for sensor acquisition and communications where appropriate.
- Initial hardware assignments are defined in [the pinout plan](stm32-pinout-plan.md).
- Later target: an STM32 Black Pill or smaller Nucleo; no replacement chosen yet.

### 3.2 ESP32 controller

- ESP32 development board (exact model TBD).
- Wi-Fi connectivity.
- Optional Ethernet connectivity.
- ESP-IDF firmware framework.
- FreeRTOS-based application.
- SPI communication with STM32.
- Interfaces for a local screen and physical controls.

### 3.3 Sensors

**Primary angle sensor**

- Analog output, nominally 0–5 V.
- Voltage conditioning for STM32 ADC compatibility.
- ADC acquisition synchronized with the control loop where practical.
- Calibration and filtering in firmware.
- Existing sensor is ERCK_0505_360. The supplied
  [ERCK datasheet](https://p3america.com/content/pdf/erck.pdf) specifies the 5 V
  version as 5 V ±10%, 0–5 V ratiometric output, 12-bit resolution, and 1 ms update.
  Confirm the installed unit's analog/PWM option and calibrate its actual range.

**Optional wireless IMU subsystem**

| Component | Selection |
|---|---|
| MCU / radio | Seeed XIAO nRF52840 (non-Sense) |
| IMU | ICM-42688-P |
| IMU interface | SPI |
| Battery | 3.7 V LiPo, 150–300 mAh |
| Receiver | nRF52840 USB Dongle |
| Target capacity | Up to 8 wireless nodes per receiver |

Wireless IMU support is a future extension and is not required for initial closed-loop control.

### 3.4 Motor and driver

- Stepper motor controlled through a STEP/DIR driver.
- STM32 hardware timer generates STEP pulses.
- GPIO controls direction and enable.
- Configurable speed, acceleration, and actuator limits.
- Safe handling of direction changes and motor disable.

The existing schematic identifies a TB6600-style optoisolated driver and a
17HS16-2004S1 bipolar stepper. Confirm the actual module model, input current,
enable polarity, pulse timing, motor current setting, microstep DIP settings,
and mechanics before motion. The module label alone is not an electrical specification.

## 4. Operator interface

The system supports both local and remote operation.

### 4.1 Local operator interface — ESP32

The ESP32 connects directly to:

- LCD, OLED, or touchscreen.
- Menu/navigation buttons.
- Optional rotary encoder.
- Start/stop controls for normal operation.
- Status indicators.

The local interface should support:

- Starting and stopping the controller.
- Selecting operating modes.
- Viewing pendulum angle and motor status.
- Adjusting controller gains.
- Viewing faults and warnings.
- Resetting faults when permitted.
- Viewing connection and system status.

The local interface must work without Wi-Fi, Ethernet, or an external computer.

### 4.2 Remote operator interface

Initially, a computer server exposes WebSocket access and bridges commands to USB
serial. Later the ESP32 exposes network interfaces for external clients.

Initial clients:

- Browser-based Web UI.
- CLI.
- Python or other development tools.

Supported operations should be consistent with the local interface.

### 4.3 Shared command model

Local and remote interfaces produce the same logical application commands.

Examples:

- `START`
- `STOP`
- `SET_MODE`
- `SET_GAINS`
- `GET_STATUS`
- `RESET_FAULT`

Initially the computer server, and later the ESP32, forwards appropriate commands
to the STM32. Manual jog commands use signed velocity targets, not individual
step messages. The STM32 ramps velocity and generates pulses locally.

The STM32 validates commands and determines whether the requested transition or configuration change is permitted.

### 4.4 Safety controls

- Emergency stop must be capable of disabling the motor independently of either MCU.
- A dedicated physical stop input may connect directly to the STM32.
- STM32 monitors motor faults and relevant safety inputs.
- Communication loss must have explicitly defined safe behavior.
- ESP32 failure must not compromise the STM32's real-time timing or hardware emergency-stop function.

## 5. Communications

### 5.1 Initial computer ↔ STM32 serial link

Use the ST-LINK virtual COM port on CN1, bridged to USART3 PD8/PD9, at
115200 baud, 8N1, no flow control. UART firmware must be added; the LED bring-up
image does not yet expose the application protocol.

The normative v1 framing, payloads, units, command responses, session handling,
telemetry, and WebSocket messages are defined in [serial-protocol.md](serial-protocol.md).
Default telemetry is 50 Hz; the control/motion update target remains 1 kHz.

Motion is explicitly armed and uses a 500 ms command lease refreshed while jog
is held. A lost browser, server, or USB connection must lead to an STM32-managed
stop. Reconnection must not resume motion automatically.

### 5.2 Future STM32 ↔ ESP32 physical interface

**Preferred:** SPI with GPIO handshake/ready signaling.

The final SPI master/slave assignment remains TBD.

### 5.3 Future STM32 ↔ ESP32 protocol

Use a shared, versioned binary protocol implemented in C.

Message categories:

| Category | Examples |
|---|---|
| Commands | Start, stop, set gains, change mode |
| Responses | Acknowledgment, rejection, current configuration |
| Telemetry | Angle, velocity, motor command, timestamps |
| Events | Fault, mode transition, controller state |
| Diagnostics | Firmware version, health, communication status |

Protocol requirements:

- Explicit message framing and lengths.
- Message type and protocol version.
- Request identifiers where acknowledgments are needed.
- Bounded message sizes.
- Error detection and recovery.
- Nonblocking operation.
- Communication health monitoring.

During initial development, the computer is the application communications peer.
In standalone operation the ESP32 assumes that role. Only one peer may own motion
authority at a time; adding SPI must preserve this arbitration. The logical
commands and payloads should be reused, with SPI framing specified when implemented.

### 5.4 Client transport abstraction

The computer server initially, and the ESP32 later, handles client transports.

- WebSocket for real-time bidirectional communication.
- HTTP for configuration and status operations.
- Optional additional transports later.

The application command model remains independent of the client transport.

## 6. STM32 firmware

### 6.1 Firmware stack

- C
- STM32 HAL
- STM32CubeMX for peripheral configuration
- CMake for builds
- Bare metal initially
- FreeRTOS as a later extension

Use HAL for all peripherals initially. Introduce LL or direct register access only when justified by a concrete requirement.

### 6.2 Real-time control loop

**Initial target:** 1 kHz.

Each control iteration:

1. Acquire sensor data.
2. Estimate system state.
3. Run the control algorithm.
4. Apply actuator limits and safety checks.
5. Update motor commands.
6. Record telemetry into a bounded buffer.

The control loop must not block on UART, SPI, logging, or user-interface activity.

### 6.3 Stepper control

- Timer-generated STEP pulses.
- Configurable pulse frequency and direction.
- Respect driver timing constraints.
- Support controlled starts and stops.
- Account for motor acceleration and missed-step risk.
- Maintain precise commanded pulse counts where required.

### 6.4 Operating state machine

Proposed states:

- `BOOT`
- `IDLE`
- `ARMED`
- `RUNNING`
- `STOPPING`
- `FAULT`

The STM32 owns all state transitions.

Commands from the computer or ESP32 are requests; the STM32 validates them.
Manual mode adds no new operating states: `ARMED` permits jog requests,
`RUNNING` means manual motion is active, and `STOPPING` applies the stop ramp.
See the serial specification for lease expiry and fault transitions.

### 6.5 Telemetry and logging

Record:

- Timestamps
- Raw sensor values
- Estimated pendulum state
- Controller output
- Motor command
- Execution time
- Operating state
- Faults and warnings

Logging must be nonblocking and use bounded memory.

## 7. ESP32 firmware

### 7.1 Firmware stack

- ESP-IDF
- C
- FreeRTOS
- SPI driver
- Wi-Fi and optional Ethernet
- HTTP and WebSocket servers
- Local display and input drivers

### 7.2 Application responsibilities

- Manage local screen and controls.
- Manage remote client connections.
- Translate UI actions into application commands.
- Communicate with STM32.
- Distribute telemetry to subscribed clients.
- Display current operating state and faults.
- Manage configuration workflows.
- Monitor STM32 connection health.

### 7.3 Suggested tasks

- STM32 communication task
- Network communication task
- Local UI task
- Telemetry distribution task

Exact task decomposition and priorities will be determined during implementation.

## 8. Portable C libraries

Control and simulation code should not depend directly on HAL, ESP-IDF, FreeRTOS, or hardware registers.

Proposed modules:

- `control` — PID, LQR, and future controllers.
- `dynamics` — pendulum physics model.
- `estimation` — filtering and state estimation.
- `protocol` — shared STM32/ESP32 message definitions and serialization.
- `common` — shared types and utilities.

The controller should operate on explicit state inputs, parameters, and time steps.

Platform-specific code handles acquisition, actuation, scheduling, and communications.

## 9. Simulation and Web UI

### 9.1 Simulation

- Implement pendulum dynamics in portable C.
- Compile to native desktop binaries and WebAssembly.
- Reuse the same controller algorithms as STM32 firmware.
- Support deterministic simulation steps.
- Model sensor noise, actuator limits, and physical parameters.

### 9.2 Browser application

Use React/TypeScript with WebAssembly for simulation.

Support two modes:

**Live mode**
- Initially connect over WebSocket to a server on the USB-connected computer.
- Later connect to the ESP32 over WebSocket using the same logical UI interface.
- Plot pendulum angle against device sample time.
- Plot stepper position, velocity, and acceleration with explicit units.
- Identify stepper values as commanded/pulse-derived until encoder feedback exists.
- Set jog speed and hold left/right buttons or arrow keys to request motion.
- Show arm/disarm, stop, device state, faults, data freshness, and connection status.
- Clear jog on release, focus loss, hidden page, or lost connection; require a new
  press to resume. The STM32 lease remains authoritative if stop messages are lost.
- Details, message examples, and acceptance criteria are in
  [the serial and UI specification](serial-protocol.md).

**Simulation mode**
- Execute physics and controller code locally.
- Visualize simulated motion.
- Adjust gains and model parameters.
- Inspect trajectories and controller behavior.

Both modes should expose a consistent logical application interface, while retaining separate timing and execution mechanisms.

## 10. System identification

Collect experimental data to estimate:

- Pendulum inertia and damping.
- Mechanical friction.
- Actuator response.
- Sensor calibration parameters.
- Other uncertain model parameters.

Use offline parameter fitting initially, with online estimation as a possible extension.

## 11. Reinforcement learning — future

- Train controllers against the physics simulator.
- Use domain randomization to improve robustness.
- Investigate compact policy inference on STM32.
- Retain conventional control and safety limits.
- Validate policies in simulation before hardware testing.

## 12. Development environment

| Tool | Purpose |
|---|---|
| Nix | Reproducible toolchain |
| CMake | Build system |
| Ninja | Build execution |
| ARM GCC | STM32 compilation |
| STM32CubeMX | STM32 hardware configuration |
| STM32 HAL | STM32 peripheral drivers |
| ESP-IDF | ESP32 firmware framework |
| OpenOCD / ST-LINK | STM32 flashing and debugging |
| Emscripten | WebAssembly compilation |
| GCC / Clang | Native builds and tests |
| React / TypeScript | Browser interface |

ESP-IDF's own CMake-based build workflow can coexist with the shared C libraries and Nix development environment.

## 13. Repository structure

```text
pendulum/
├── flake.nix
├── CMakeLists.txt
│
├── firmware/
│   ├── stm32/
│   │   ├── Core/
│   │   ├── Drivers/
│   │   └── app/
│   │
│   └── esp32/
│       ├── main/
│       └── components/
│
├── lib/
│   ├── control/
│   ├── dynamics/
│   ├── estimation/
│   ├── protocol/
│   └── common/
│
├── simulation/
│   ├── native/
│   └── wasm/
│
├── web/
│   ├── server/       # USB serial bridge and WebSocket server
│   └── client/       # React UI and simulation
│
├── tests/
│
├── kicad/            # Due reference; separate STM32 project to follow
│
└── docs/
```

Generated STM32 configuration files should remain separate from handwritten application code.

## 14. Development milestones

| Phase | Deliverable |
|---|---|
| 1 | STM32 build, flashing, debugging, HAL setup |
| 2 | Confirm wiring/electrical interfaces; ADC angle acquisition and calibration |
| 3 | USART3 binary protocol, computer serial bridge, WebSocket, angle chart |
| 4 | Timer STEP generation, limits, motion lease; browser manual jog and stepper charts |
| 5 | Fixed-frequency control loop and initial closed-loop pendulum controller |
| 6 | Select and port to an STM32 Black Pill or smaller Nucleo |
| 7 | STM32–ESP32 SPI transport, local screen/buttons, standalone operation |
| 8 | ESP32 WebSocket/HTTP interface using the shared logical command model |
| 9 | Portable simulator, telemetry recording, and system identification |
| 10 | FreeRTOS integration and performance improvements |
| 11 | Wireless IMUs and advanced control experiments |

The exact order may change as hardware becomes available.

## 15. Open decisions

- ESP32 model and development board.
- Exact TB6600 module characteristics and motor/driver settings.
- Smaller STM32 board and MCU selection.
- Pendulum mechanical design.
- Installed ERCK analog/PWM option, angle calibration, and supply compensation.
- Local screen type and input controls.
- SPI master/slave arrangement.
- Future SPI framing and transport-specific telemetry budget (UART v1 is specified).
- Mechanical travel limits, homing/reference method, and pulses-to-distance conversion.
- Operating-mode and safety requirements.
- Whether swing-up control is included in the initial release.

---

## Initial implementation target

The next iteration is computer-connected sensing and manual motion:

1. STM32 acquires the angle sensor and reports timestamped telemetry.
2. A computer server bridges its USB serial port to a browser WebSocket.
3. The browser plots angle, pulse-derived stepper position, velocity, and acceleration.
4. The operator sets jog speed and holds left/right buttons or arrow keys to move.
5. STM32 owns arming, acceleration limits, pulse timing, and communication-loss stops.

## Eventual standalone target

Build a standalone inverted pendulum controller where:

1. The **STM32** reads the angle sensor, runs the control loop, and drives the stepper motor.
2. The **ESP32** provides a local display and buttons, allowing operation without a computer.
3. The STM32 and ESP32 communicate through SPI.
4. The ESP32 additionally exposes a WebSocket interface for remote monitoring and control.
5. The same portable C controller can run in the STM32 firmware and browser simulation.

**Core architectural principle:** The STM32 controls the physical system; the ESP32 controls how people and external software interact with it.
