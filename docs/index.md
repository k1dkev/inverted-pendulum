# Inverted Pendulum

Firmware, control policies, simulation, and operator tools for a cart-mounted
inverted pendulum. The current target is the **NUCLEO-F767ZI**, with a future
move to a smaller STM32 board.

The STM32 currently runs the plant simulation and a selectable manual or legacy
swing-up/LQR policy. A local Node server bridges its ST-LINK USB serial port to a
React dashboard with motion controls and live graphs. Physical sensor acquisition
and motor actuation are still future milestones.

Start with the setup guide to build and connect. The control guide records the
exact legacy law and its source history.

```{toctree}
:maxdepth: 2
:caption: Start here

getting-started
control-policy
```

```{toctree}
:maxdepth: 2
:caption: Design and reference

project-specification
stm32-pinout-plan
serial-protocol
simulation-strategy
```

```{toctree}
:maxdepth: 1
:caption: Project

documentation
Source repository <https://github.com/k1dkev/inverted-pendulum>
KiCad hardware files <https://github.com/k1dkev/inverted-pendulum/tree/stm32-bringup/kicad>
```
