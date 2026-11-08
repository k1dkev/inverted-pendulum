# NUCLEO-F767ZI pinout and wiring plan

Status: proposed physical wiring; current firmware is simulation-only. Target:
NUCLEO-F767ZI / STM32F767ZIT6, MB1137. Verify the board revision and connector
orientation before wiring. Connector numbers below are physical header pin
numbers, not the Arduino Due symbol's pin numbers.

## 1. Existing setup and migration

The supplied Arduino Due schematic shows:

- ERCK_0505_360 sensor: red supply to 5 V, black to ground, yellow output through
  approximately 4.7 kΩ + 0.56 kΩ, with 9.4 kΩ to ground. The divider junction
  goes to Due A8 via the blue wire.
- Due D5 → PUL+, D6 → DIR+, D7 → ENA+ on a TB6600-style driver;
  PUL−, DIR−, and ENA− share Due ground (common cathode).
- Driver B− blue / B+ red / A− black / A+ green to the 17HS16-2004S1 stepper,
  as drawn. Confirm winding pairs with the actual motor; colors are not universal.
- Motor supply is separate from USB logic power; its full circuit is outside the
  supplied image. Do not infer its voltage/current capability from the cropped view.

The editable original is now preserved under [kicad/](../kicad/README.md).
Keep it as the Due reference and create the STM32 schematic as a separate project.

Keep the same signal roles. Due A8 is moved to Nucleo A3; numeric analog labels
do not imply equivalent MCU pins. D5/D6/D7 can retain their familiar labels,
but they are 3.3 V STM32 signals and require a verified driver interface.

## 2. Proposed assignments

| Role | STM32 pin / peripheral | Board connection | Destination / use |
|---|---|---|---|
| Angle input | PF3 / ADC3_IN9 | A3, CN9 pin 7 | Conditioned sensor output; replaces Due A8 |
| STEP | PE11 / TIM1_CH2, AF1 | D5, CN10 pin 6 | Via driver interface to PUL+ |
| DIR | PE9 / GPIO output | D6, CN10 pin 4 | Via driver interface to DIR+ |
| ENABLE | PF13 / GPIO output | D7, CN10 pin 2 | Via driver interface to ENA+; polarity TBD |
| Sensor 5 V supply | Board +5 V | CN8 pin 9 | Sensor red, within verified USB power budget |
| Sensor/logic return | GND | CN8 pin 11 or 13 | Sensor black and signal-interface return |
| Serial TX | PD8 / USART3_TX, AF7 | Internal ST-LINK connection | STM32 → computer |
| Serial RX | PD9 / USART3_RX, AF7 | Internal ST-LINK connection | Computer → STM32 |
| Programming + serial USB | ST-LINK/V2-1 | CN1 USB ST-LINK | One data-capable USB cable to computer |
| Left limit, reserved | PF15 / GPIO input | D2, CN10 pin 12 | Future conditioned limit input |
| Right limit, reserved | PF14 / GPIO input | D4, CN10 pin 8 | Future conditioned limit input |
| Stop-status input, reserved | PF12 / GPIO input | D8, CN7 pin 20 | Auxiliary hardware stop contact |

Header mappings and the USART bridge are based on ST's
[UM1974 Rev 11](https://www.st.com/resource/en/user_manual/um1974-stm32-nucleo144-boards-mb1137-stmicroelectronics.pdf),
section 7.9 and Table 19 (F746ZG/F756ZG/F767ZI). Check the F767ZI table rather
than the similar tables for other Nucleo boards. Timer alternate function must
also be checked in [the STM32F767ZI datasheet](https://www.st.com/resource/en/datasheet/stm32f767zi.pdf).

PF3 avoids the analog/header pins shared with Ethernet signals. Keep PB0/PB7/PB14
for LD1/LD2/LD3. Preserve SWD on PA13/PA14, NRST, and optional SWO on PB3.
Reserve TIM1 for motion pulses and select a separate timer for the 1 kHz update;
configure PE9 as GPIO, not TIM1_CH1. Board-specific choices belong in the board
layer and eventual CubeMX `.ioc`, not the portable motion or protocol libraries.

No SPI pins are assigned yet. Allocate the future ESP32 SPI and handshake pins
after confirming the local hardware; do not repurpose USART3 or SWD.

## 3. Angle sensor conditioning

The user supplied the [P3 America ERCK datasheet](https://p3america.com/content/pdf/erck.pdf).
It specifies the 5 V version at 5 V ±10%, with a ratiometric 0–5 V output,
12-bit resolution, 1 ms update, less than 16 mA unloaded supply current, and a
voltage-output load of at least 5 kΩ. The 0505 version also has an optional PWM
output: confirm the installed ERCK_0505_360 is analog, as the existing divider/ADC
wiring suggests. The plan assumes that analog variant; PWM would require a timer
capture input and its own level conditioning instead.

Check the actual output before connecting it to PF3.
An ADC input must remain within the analog supply/reference range; digital
5 V tolerance does not make an analog input safe for 5 V conversion.

For the pictured divider:

```text
sensor OUT -- 4.7k -- 0.56k --+-- PF3 / A3
                            |
                           9.4k
                            |
                           GND

Vadc = Vsensor × 9.4 / (4.7 + 0.56 + 9.4)
     ≈ Vsensor × 0.641
```

This gives about 3.206 V at a nominal 5.000 V input, but about 3.526 V at 5.5 V,
the upper end of the sensor's allowed supply range, before resistor tolerances.
The original 14.66 kΩ total divider meets the stated minimum load resistance but
does not provide adequate ADC voltage margin over the full supply range.
Do not treat the existing divider as validated for
the Nucleo's actual VDDA. Measure the maximum sensor output and VDDA and include
supply tolerance, resistor tolerance, and startup/power-off behavior.

A provisional alternative is 8.2 kΩ series / 10 kΩ to ground, both 1%:
nominal gain 0.549, producing about 3.022 V at a 5.5 V input (about 3.05 V
at the worst divider ratio from 1% resistor tolerances). Total load is 18.2 kΩ.
Validate this against minimum actual VDDA, transients, and the installed sensor.
Check output loading and ADC acquisition time against source impedance; choose
any RC filter and ADC sample time against the required control bandwidth.
Consider buffering/protection if required by the measured interface, including
the case where the sensor is powered and the MCU is not.

Calibration records ADC values at known angles, wrap behavior, angle direction,
and upright reference. Report radians on the wire; the UI may display degrees.
Keep raw ADC telemetry available to diagnose wiring or calibration problems.
Because the output is ratiometric to the sensor's 5 V supply while the ADC uses
VDDA, supply variation changes the voltage-to-angle mapping. Measure stability
and choose a sufficiently stable sensor supply, or add separately conditioned
supply measurement/compensation before claiming angle accuracy across that range.
The sensor's 1 ms update also bounds fresh angle information at a 1 kHz loop.

## 4. Driver interface and power

The existing common-cathode scheme can be retained using a **verified 3.3 V
logic-input to 5 V output driver/buffer** capable of the actual module's
opto-input current and pulse timing. STM32 outputs drive that interface; its
outputs drive PUL+/DIR+/ENA+, with the three minus terminals tied to the
interface's logic ground. Select the buffer after obtaining module specifications.

Do not use the schematic note that 3.3 V “seems to work” as the design criterion.
For comparison, [DFRobot's TB6600 module](https://wiki.dfrobot.com/dri0043)
specifies 5 V control pulses; it is a reference example, not confirmation of
the user's module. A transistor/common-anode interface is another option but
changes wiring and possibly signal polarity; document that separately if chosen.

Requirements before enabling motion:

- Confirm PUL/DIR voltage, current, active edge, minimum pulse widths, DIR
  setup/hold time, enable polarity, and enable-to-step delay for the actual unit.
- Hardware defaults and firmware initialization must prevent step edges at
  reset. Verify both the driver's enabled/disabled behavior and the interface's
  power-up behavior; an unpowered optocoupler does not universally mean disabled.
- Motor power goes only to the driver's power terminals. Nucleo USB power is
  for logic/sensor power within its budget, never the motor supply. Do not connect
  an external 5 V supply to USB-powered +5 V without checking board power selection.
- The common-cathode signal return is Nucleo/interface ground. The motor-supply
  return is wired per the actual driver manual; do not add a connection across
  the optoisolation barrier merely because both are labeled ground.
- Provide an independent, suitable hardware motor-disable/stop path. The reserved
  stop-status GPIO only observes it. Reserved GPIOs need appropriate conditioning;
  use fail-open contact logic where feasible and fault on disconnected contacts.
- Configure conservative speed/acceleration and travel limits for the mechanics.
  With no limit switches or homing, use a clear, bounded bench test area and do
  not imply software position is an absolute physical reference.

## 5. USB serial and migration to a smaller board

CN1 serves programming/debugging and a virtual COM port through the same cable.
The application uses USART3 on PD8/PD9, not native USB firmware on CN13. With
factory routing, SB5/SB6 connect USART3 to ST-LINK; keep PD8/PD9 dedicated to it.
The host selects the enumerated serial device (typically `/dev/cu.usbmodem…`
on macOS). Do not hard-code the device suffix.

For a later Black Pill or smaller Nucleo, reassess ADC/timer assignments and the
USB/debug path. A board without an integrated ST-LINK virtual COM bridge needs
an external UART bridge or native USB CDC implementation, plus a debug probe as
appropriate. Preserve protocol semantics across that transport change.

## 6. Wiring acceptance checklist

1. Confirm board/module/sensor identities, supplies, connector orientation, and
   motor winding pairs with motor power off.
2. Measure sensor divider range; verify its maximum is below the minimum expected
   VDDA with margin. Confirm the ADC calibration and disconnect detection plan.
3. Observe STEP/DIR/ENABLE at the driver interface with a scope or logic analyzer;
   verify boot, reset, direction reversal, stop, and required timing.
4. Verify USART3 telemetry and commands through CN1 while motor power is off.
5. Verify hardware stop and software lease expiry before increasing motion speed.
6. Verify one emitted STEP edge increments/decrements the pulse position once.
   Confirm left/right orientation at low speed, then document the configured sign.
