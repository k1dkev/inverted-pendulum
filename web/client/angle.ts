export const ANGLE_VIEWS = {
  upright: {
    label: "Upright = 0°",
    unit: "degrees",
    domain: [-180, 180] as [number, number],
    hint: "Clockwise is positive. Downward is ±180°. Gaps mark angle wrap.",
  },
  absolute: {
    label: "Absolute angle from upright · 0–180°",
    unit: "degrees",
    domain: [0, 180] as [number, number],
    hint: "0° = upright, 180° = bottom. Equal left/right tilts have the same value, without wrap jumps.",
  },
  bottom: {
    label: "Bottom = 0°",
    unit: "degrees",
    domain: [-180, 180] as [number, number],
    hint: "Downward is 0°. Upright is ±180°. Gaps mark angle wrap.",
  },
  horizontal: {
    label: "Horizontal = 0° · upright = 90°",
    unit: "degrees",
    domain: [-180, 180] as [number, number],
    hint: "Right horizontal is 0°, upright +90°, bottom −90°. Counterclockwise is positive.",
  },
  cosine: {
    label: "cos(θ)",
    unit: "unitless",
    domain: [-1, 1] as [number, number],
    hint: "+1 = upright, −1 = bottom, 0 = horizontal. Equal left/right tilts have the same value.",
  },
} as const;
export type AngleView = keyof typeof ANGLE_VIEWS;
export function wrapDegrees(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}
/** Display transform only. Firmware/controller convention remains upright = 0 rad. */
export function displayAngle(
  radians: number | null,
  view: AngleView,
): number | null {
  if (radians === null || !Number.isFinite(radians)) return null;
  if (view === "cosine") return Math.cos(radians);
  const degrees = (radians * 180) / Math.PI;
  if (view === "absolute") return Math.abs(wrapDegrees(degrees));
  return wrapDegrees(
    view === "bottom"
      ? degrees - 180
      : view === "horizontal"
        ? 90 - degrees
        : degrees,
  );
}
