# Hardware designs

The existing Arduino Due reference project is preserved at
[inverted-pedulum-kicad/inverted-pedulum-kicad.kicad_pro](inverted-pedulum-kicad/inverted-pedulum-kicad.kicad_pro).
The historical `pedulum` spelling is retained to keep the restored paths intact.
This is the old Due design, not a validated STM32 schematic.
The restored `.kicad_pcb` is an empty board placeholder; the schematic contains
the existing circuit.

Restored from `k-chart-dev-fork` commit
`2422cb98d9a89a0a371889a5854467bd504f10db`. The custom symbol library remains a
Git submodule pinned to `756808114dddc9bc4e05514d5043e3e5f01c7863`.

After cloning, initialize the library before editing:

```sh
git submodule update --init --recursive
```

The project's `sym-lib-table` resolves the library relative to the project,
through `../libs/kkuney-kicad-lib/kkuney-kicad-lib.kicad_sym`.

Create the new STM32 project in a sibling directory, suggested
`kicad/stm32-pendulum/`, and keep this Due design as the reference. Give the new
project its own project-relative symbol library table. Use
[the STM32 pinout plan](../docs/stm32-pinout-plan.md) for the proposed assignments
and electrical issues to resolve before wiring. The new STM32 schematic has not
been created yet.
