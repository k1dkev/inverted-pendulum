# Pendulum

A fresh C firmware foundation for the STM32 + ESP32 inverted pendulum described
in [the project specification](docs/project-specification.md).

Plans for the next iteration:

- [STM32 pinout and wiring](docs/stm32-pinout-plan.md)
- [USB serial protocol, telemetry, and browser jog controls](docs/serial-protocol.md)
- [KiCad hardware projects and original Arduino Due reference](kicad/README.md)

These are design specifications; the current firmware implements the LED sequence only.

This first milestone builds standalone STM32 firmware that cycles through
LD1 (green), LD2 (blue), LD3 (red), then all three together. Each step lasts
500 ms, and the full sequence repeats every two seconds.

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
nix develop
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

Alternatively, install Just, CMake >= 3.24, Ninja, ARM GCC/binutils, and OpenOCD.
On macOS:

```sh
brew install just cmake ninja arm-none-eabi-gcc openocd
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

OpenOCD programs, verifies, resets, and runs the image. The user LEDs should cycle
green → blue → red → all three, advancing every half-second.
Hardware verification requires the actual board.

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

```gdb
target extended-remote localhost:3333
monitor reset halt
load
break main
continue
```

## Layout and scope

- `firmware/stm32/app/`: handwritten application logic
- `firmware/stm32/Core/`: handwritten board setup, SysTick handler, HAL config,
  and minimal C initialization
- `firmware/stm32/STM32F767ZI.ld`: memory layout and stack reservation
- `cmake/`: cross-compilation toolchain
- `docs/`: project specification, pinout plan, and serial/UI protocol
- `kicad/`: original Due schematic/PCB/project and custom symbol-library submodule

ST's startup assembly initializes RAM and calls the application. SysTick drives
the HAL millisecond tick. This freestanding C build links no libc; its small
runtime supplies the initializer-array entry point used by ST startup. The blink
uses `HAL_Delay` for bring-up only; the future control loop must use deterministic
timer scheduling.

No CubeMX configuration has been generated yet. When adding peripheral configuration for the F767ZI,
check in its `.ioc` and keep generated configuration separate from `app/`.
ESP32, motor control, sensors, portable control libraries, and simulation remain
future milestones.

The previous Arduino and web project remains in Git history on `dev`; the fresh
STM32 work lives on `stm32-bringup`.
