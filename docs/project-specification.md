# Pendulum — Project Specification

**Version:** 0.2  
**Status:** Draft  
**Primary language:** C  
**Controllers:** STM32 + ESP32  
**Build system:** CMake + Nix

## 1. Overview

Build an inverted pendulum system with real-time motor control, local and remote operator interfaces, telemetry, and a physics-based simulator.

The system uses two microcontrollers with separate responsibilities:

- **STM32:** Real-time control, sensors, motor actuation, and safety.
- **ESP32:** Local user interface, networking, client communications, and configuration.

The pendulum must be operable without a computer or network connection.

Control algorithms should remain portable across embedded firmware, native desktop applications, and WebAssembly.

## 2. System architecture

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

Actual motor, driver, and mechanical specifications remain TBD.

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

The ESP32 exposes network interfaces for external clients.

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

The ESP32 forwards appropriate commands to the STM32.

The STM32 validates commands and determines whether the requested transition or configuration change is permitted.

### 4.4 Safety controls

- Emergency stop must be capable of disabling the motor independently of either MCU.
- A dedicated physical stop input may connect directly to the STM32.
- STM32 monitors motor faults and relevant safety inputs.
- Communication loss must have explicitly defined safe behavior.
- ESP32 failure must not compromise the STM32's real-time timing or hardware emergency-stop function.

## 5. STM32 ↔ ESP32 communication

### 5.1 Physical interface

**Preferred:** SPI with GPIO handshake/ready signaling.

The final SPI master/slave assignment remains TBD.

### 5.2 Protocol

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

The STM32 communicates only with the ESP32 for normal application communications.

### 5.3 Client transport abstraction

The ESP32 handles the differences between client transports.

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

The control loop must not block on SPI, logging, or user-interface activity.

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

Commands from the ESP32 are requests, not direct motor-control authority.

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
- Connect to ESP32 over WebSocket.
- Display real pendulum telemetry.
- Send configuration and operator commands.

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
│
├── tests/
│
└── docs/
```

Generated STM32 configuration files should remain separate from handwritten application code.

## 14. Development milestones

| Phase | Deliverable |
|---|---|
| 1 | STM32 build, flashing, debugging, HAL setup |
| 2 | STM32 ADC, GPIO, timers, and stepper control |
| 3 | Fixed-frequency control loop and sensor calibration |
| 4 | Initial closed-loop pendulum controller |
| 5 | Shared binary protocol and STM32–ESP32 SPI communication |
| 6 | ESP32 local screen, buttons, and standalone operation |
| 7 | ESP32 WebSocket/HTTP interface and remote control |
| 8 | Portable simulator and browser visualization |
| 9 | Telemetry recording and system identification |
| 10 | FreeRTOS integration and performance improvements |
| 11 | Wireless IMUs and advanced control experiments |

The exact order may change as hardware becomes available.

## 15. Open decisions

- ESP32 model and development board.
- Stepper motor and driver.
- Pendulum mechanical design.
- Angle sensor specifications.
- Local screen type and input controls.
- SPI master/slave arrangement.
- Binary protocol encoding and telemetry rates.
- Operating-mode and safety requirements.
- Whether swing-up control is included in the initial release.

---

## Initial implementation target

Build a standalone inverted pendulum controller where:

1. The **STM32** reads the angle sensor, runs the control loop, and drives the stepper motor.
2. The **ESP32** provides a local display and buttons, allowing operation without a computer.
3. The STM32 and ESP32 communicate through SPI.
4. The ESP32 additionally exposes a WebSocket interface for remote monitoring and control.
5. The same portable C controller can run in the STM32 firmware and browser simulation.

**Core architectural principle:** The STM32 controls the physical system; the ESP32 controls how people and external software interact with it.