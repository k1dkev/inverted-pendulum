# Pendulum

A fresh C firmware foundation for the STM32 + ESP32 inverted pendulum described
in [the project specification](docs/project-specification.md).

Plans for the next iteration:

- [STM32 pinout and wiring](docs/stm32-pinout-plan.md)
- [USB serial protocol, telemetry, and browser jog controls](docs/serial-protocol.md)
- [Pluggable policies and the original swing-up/LQR controller](docs/control-policy.md)
- [Simulation strategy: STM32, native/WASM, and future MuJoCo engine](docs/simulation-strategy.md)
- [KiCad hardware projects and original Arduino Due reference](https://github.com/k1dkev/inverted-pendulum/tree/stm32-bringup/kicad)

The current firmware runs a pendulum and stepper **simulation on the STM32**,
streams binary telemetry through the ST-LINK USB serial port, and accepts commands
from a local web console. It never configures STEP/DIR/ENABLE outputs or drives
the physical motor. Physical sensors and motion remain a later milestone.

## Initial hardware target

**NUCLEO-F767ZI / STM32F767ZIT6** is the selected board.
The user LEDs are active-high: LD1 on PB0, LD2 on PB7, and LD3 on PB14
(factory solder-bridge configuration), as
documented in ST's
[NUCLEO-144 user manual](https://www.st.com/resource/en/user_manual/dm00244518-stm32-nucleo-144-boards-mb1137-stmicroelectronics.pdf).
The Cortex-M7 image uses 2 MiB flash and 128 KiB DTCM for data and stack;
the separate 384 KiB SRAM region is reserved for future use, including DMA
buffers. It uses the reset-default 16 MHz HSI clock.
It starts at `0x08000000`, without a bootloader.

Use this image only on the matching MCU. A different board needs matching CMSIS
startup/device definitions, linker memory map, LED wiring, and OpenOCD target.

## Build

With Nix installed and flakes enabled:

```sh
nix develop --command zsh
just build
```

The flake pins nixpkgs to an immutable revision. On a Git checkout, Nix only sees
tracked files: stage new files with `git add` before the first `nix develop`.
If Nix reports that `nix-command` or `flakes` is disabled, enter the shell with:

```sh
nix --extra-experimental-features 'nix-command flakes' develop
```

If a newly installed Nix is not found on macOS, open a new terminal or load its
shell setup with `source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh`.
When switching between Homebrew and Nix tools, run
`cmake --fresh --preset stm32-debug` inside the desired environment before
`just build` so CMake does not reuse cached tool paths.

Alternatively, install Just, CMake >= 3.24, Ninja, ARM GCC/binutils, OpenOCD,
and Node.js 22.17 or newer.
On macOS:

```sh
brew install just cmake ninja arm-none-eabi-gcc openocd node@22
just build
```

Run `just` to list commands. `just build`, `just flash`, and `just debug-server`
configure automatically. `just clean` removes compiled outputs while retaining
downloaded dependencies. The underlying CMake presets remain available.

The first configure downloads hash-verified ST F7 HAL v1.3.3, ST F7 CMSIS device
v1.2.10, and ARM CMSIS 5.9.0 sources into `build/stm32-debug/_deps/`. Later builds
reuse them. Upstream source and license files stay intact there; no vendor files
are copied into the handwritten source tree.

Artifacts appear under `build/stm32-debug/firmware/stm32/`:

- `pendulum.elf`: firmware with debug symbols
- `pendulum.hex` and `pendulum.bin`: programming images
- `pendulum.map`: section and symbol layout

## Flash and debug

Connect a data-capable cable to **CN1 (USB ST-LINK / USB PWR)** on the small
ST-LINK end of the board, opposite the Ethernet socket. CN13 beside Ethernet is
the STM32 user USB port; use CN1 for these OpenOCD commands. See the connector
layout in ST's [UM1974, Figure 4](https://www.st.com/resource/en/user_manual/um1974-stm32-nucleo144-boards-mb1137-stmicroelectronics.pdf).

```sh
just flash
```

OpenOCD programs, verifies, resets, and runs the image. LD1 green blinks as a
heartbeat; LD2 blue lights after a serial protocol session is established; LD3
red indicates a latched simulated-device fault. This replaces the earlier
four-stage LED sequence.

If OpenOCD reports `Error: open failed`, it has not opened the ST-LINK probe.
On macOS, check whether USB enumeration shows ST-LINK:

```sh
system_profiler SPUSBDataType
```

If ST-LINK is absent, check CN1, try a known data-capable cable, and try another
USB port or a direct connection instead of a hub. Power LEDs alone do not
confirm a USB data connection. Once ST-LINK appears, retry `just flash`.
If it appears but OpenOCD still cannot open it, close other debug/programming
tools that may be using the probe and retry.

For debugging, start the server in one terminal:

```sh
just debug-server
```

In another terminal, use an ARM-capable GDB (provided by the Nix toolchain):

```sh
arm-none-eabi-gdb build/stm32-debug/firmware/stm32/pendulum.elf
```

```text
target extended-remote localhost:3333
monitor reset halt
load
break main
continue
```

## USB simulation and web console

One-time dependency installation, then flash and run:

```sh
nix develop --command zsh
just web-install
just flash
just web
```

Open **http://localhost:3000**, refresh the device list, select the STM32 USB
serial port, and click **Connect device**. On macOS it normally contains
`usbmodem`; the server may enumerate its `/dev/tty.*` path. Use CN1 / ST-LINK,
the same USB cable used to flash the board. No sensor or motor wiring is needed.

The frontend connects to the local server via WebSocket. That server owns the
serial port at 115200 baud; the firmware uses USART3 PD8/PD9 through ST-LINK's
virtual COM bridge. USB/debug connection and protocol handling keep running
while simulated physics is paused.

- Four plots show angle, simulated step position, velocity, and acceleration.
  All motion values are simulated pulse counts/rates, not encoder feedback.
- The angle graph selector offers **upright = 0°**, **absolute angle from upright
  (0–180°)**, **bottom = 0°**,
  **horizontal = 0° / upright = 90°**, or **cos(θ)**. This only changes the plot;
  firmware and the animation keep upright = 0 radians. Cosine is +1 upright and
  −1 downward, but does not distinguish equal left/right tilts. Angular wrap
  crossings produce trace gaps for signed angles rather than misleading vertical
  lines. Absolute angle folds left/right tilt into 0–180°, remaining continuous
  through downward crossings. Use **Auto-scale** to fit smaller movements; default
  axes are ±180° for signed angles, 0–180° for absolute angle, or ±1 for cosine.
- Click **Take control**, then **Arm manual motion**. Hold the left/right buttons
  or arrow keys to jog at the selected speed. Release or press Space to stop.
  Manual mode stays armed between jogs while the browser remains connected and
  responsive. Disarm, faults, or losing focus/connection require arming again.
  Keyboard shortcuts are ignored in input fields.
  A fresh arrow press immediately overrides a normal stop ramp or the other held
  arrow; releasing the newest arrow restores the other if still held. Velocity
  still changes under the configured acceleration limit. No return to the origin
  is required. Fault-induced stopping remains locked out.
- Set **Acceleration / deceleration** in mm/s² and apply it while stationary
  (IDLE or ARMED). It controls both speeding up and ramped stops. The default
  is the legacy code's 10,000 mm/s² limit; allowed range is 1–10,000 mm/s².
  It persists through simulation resets and serial reconnects, and resets to the
  default on MCU reboot.
- The simulation lab can **Reset**, **Pause/Resume**, or apply initial angle,
  angular velocity, step position, and step velocity. The initial-state form
  defaults to paused so you can inspect exactly what was set. Resume before
  arming. Reset/state changes are accepted only while IDLE; disarm first if needed.
- **Pivot inertia** (kg·m²) and **viscous damping** (N·m·s/rad) are editable in
  the simulation lab while the cart is stationary in IDLE or ARMED. Values are
  applied on the STM32, read back for confirmation, and preserved through reset
  and reconnect. Reboot restores defaults. Flash the new firmware before using
  the new parameter commands.
- Reset restores a 0.2 rad tilt and stationary stepper. The upright equilibrium
  is unstable; with Manual selected the pendulum falls and swings under gravity.
  Select and start the legacy policy to exercise swing-up and balancing. The model uses the old code's mass 0.094 kg,
  center-of-mass distance 0.1444 m, and pivot inertia 0.00267683 kg·m². Default
  damping is approximately 0.0004015245 N·m·s/rad. Travel is 0.02 mm per
  simulated pulse. Motion defaults come from the old Due code:
  8× microstepping, 1,600 pulses/revolution, 32 mm/revolution, and about 320 mm/s
  maximum speed (16,000 pulses/s). These are simulation settings; verify the
  physical driver DIP switches and mechanics before using them on hardware.
- Cart travel is bounded to **−190..+190 mm** (±9500 pulses), matching the
  legacy track limit. The model enforces inelastic hard end stops; outward
  intent cannot move beyond them, and inward motion works immediately. Initial
  positions outside the track are rejected. The larger animation uses this
  same scale, labeled end stops, an origin marker, and live position in mm.
- Simulation capabilities and mode are advertised by the device. The server
  refuses simulation-only commands for a device that does not advertise them.
- The bridge stops jog refreshes when input becomes stale, and the STM32 has its
  own 500 ms command lease. Lost connections never resume motion automatically.
  After MCU reset, disconnect/reconnect in the console to establish a new session.

The server listens only on loopback. Close other applications using the serial
port before connecting. If the board still runs the old LED sequence, flash
the current firmware before expecting telemetry.

In the **Control policy** panel, choose **swingup lqr v1**, then **Arm** and
**Run policy** to run the original 100 Hz swing-up → LQR controller against the
simulation. You can change policies while running; the incoming controller starts
with fresh internal state and retains the plant state. Selecting Manual requests
a stop before jogging. See [the exact legacy law and its quirks](docs/control-policy.md).

Select **swingup lqr v2** for automatic retries after a fall, corrected
angular velocity, and bounded centering with a RECENTER phase. It uses the
original energy model and LQR gains, with an upright-energy target and a bounded
increase in pumping when swings stop making progress. Recovery can require
several attempts.
See [the recovery policy](docs/recovery-policy.md) for thresholds and limits.

The **Logs & command console** panel records structured MCU/server/operator events,
with filtering, bounded history, and NDJSON download. Type `help` for commands,
`status` to query the MCU, or `jog 20 500` for a timed manual jog after arming.
The console shares ownership and serial access with the buttons. See
[logging, console commands, and the future CLI/TUI plan](docs/logging-and-console.md).

The four overview state graphs stay on their existing 50 Hz stream. The control
plot overlays raw and acceleration-limited u, with toggles for each trace and a
separate 0/1 clipping plot. Clipping refers to the acceleration clamp before
the separate motor speed limit. When available, the overview also shows v3's
estimated a and c alongside the simulation plant's actual parameters.
Open **Telemetry lab** to query the MCU's 30-channel catalog, choose additional signals and a
5/10/25 Hz rate, and plot only those selected channels. Diagnostics include
controller energy, energy threshold, raw/limited acceleration, integral, and
filtered angular velocity. Optional streaming starts disabled. Read-only browser
clients can choose their own graphs without acquiring motion control.

To run locally without a board, with a real virtual serial port:

```sh
just web-sim
```

Select **Local C simulator · virtual serial · /dev/…** in the console. The server
launches the same C device/model/policy core, creates a raw OS pseudo-terminal,
and connects through the normal SerialPort path. Reset, graphs, policies, logs,
and the command console work as they do with the STM32 simulation. Ctrl-C stops
the server and simulator. See [local virtual-serial simulation](docs/local-simulation.md)
for lifecycle, reconnect behavior, and what this mode validates.

`just web-mock` retains the lighter process-pipe simulator used by earlier tests;
select **Native C simulator** in that mode. Neither local mode validates USB,
electrical UART timing, or MCU execution.

Checks and production server:

```sh
just test
just web-build
npm --prefix web start
```

`PORT=3001 just web` selects a different local port. Dependency versions are
locked in `web/package-lock.json`; use `just web-install` after dependency changes.

## Documentation site

The Sphinx site uses MyST Markdown and the Furo theme. In `nix develop`, run
`just docs` and open <http://localhost:8000>. `just docs-build` performs a strict
build without starting a server. See [publishing and editing docs](docs/documentation.md)
for GitHub Pages setup and a non-Nix installation.

## Layout and scope

- `firmware/stm32/app/`: handwritten application logic
- `firmware/stm32/Core/`: handwritten board setup, SysTick handler, HAL config,
  and minimal C initialization
- `firmware/stm32/STM32F767ZI.ld`: memory layout and stack reservation
- `lib/`: portable C packet codec, simulated device state machine, and physics
- `simulation/native/`: native binary serial peer for development and tests
- `web/server/`: local USB serial bridge and WebSocket server
- `web/client/`: React dashboard, plots, and manual/simulation controls
- `tests/` and `web/test/`: C and protocol/bridge integration tests
- `cmake/`: cross-compilation toolchain
- `docs/`: project specification, pinout plan, and serial/UI protocol
- `kicad/`: original Due schematic/PCB/project and custom symbol-library submodule

ST's startup assembly initializes RAM and calls the application. SysTick drives
the HAL millisecond tick. This freestanding C build links no libc; its small
runtime supplies initializer-array and basic memory routines used by startup
and the portable C core. USART3 uses bounded interrupt-driven RX/TX rings, without
DMA. Simulation advances at a fixed 1 ms step from the HAL tick in the main loop;
physical real-time control will require deterministic timer scheduling.

No CubeMX configuration has been generated yet. When adding peripheral configuration for the F767ZI,
check in its `.ioc` and keep generated configuration separate from `app/`.
ESP32, physical motor control, sensor acquisition, and balancing algorithms
remain future milestones. The simulation firmware is not a hardware motor controller.

The previous Arduino and web project remains in Git history on `dev`; the fresh
STM32 work lives on `stm32-bringup`.

For repeatable controller/plant scenarios, run `nix develop --command just test-controller`. See [controller testing](docs/controller-testing.md) for scenario inputs, metrics, and limits.
