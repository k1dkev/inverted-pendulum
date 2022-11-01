function dynamics(x, u) {
  // x = [x,v,θ,ω], u = acceleration
  const Le = 197.21; // m
  const g = 9810; // m/s^2
  const b = 0.25; // m*s
  return [x[1], u, x[3], (g * Math.sin(x[2]) - u * Math.cos(x[2])) / Le - b * x[3]];
}

function integrate(x, u, xdot, dt) {
  const MAX_DT = 0.0001;
  let _dt = dt;
  let _x = [...x];
  while (_dt > 0.0) {
    let DT = _dt > MAX_DT ? MAX_DT : _dt;
    let _xdot = xdot(_x, u);
    _x = _x.map((x, i) => x + _xdot[i] * DT);
    _dt -= DT;
  }
  return _x;
}

function scaleValue(x, x1, x2, y1, y2) {
  if (x1 === x2) {
    throw new Error("x1 and x2 cannot be equal");
  }

  if (y1 === y2) {
    throw new Error("y1 and y2 cannot be equal");
  }
  return (x - x1) * ((y2 - y1) / (x2 - x1)) + y1;
}

function integratePendulumDynamics(x, dt, keys) {
  // constants
  const MAX_ACCEL = 3000.0;
  const MAX_VEL = 400.0;
  const MAX_POS = 224.5;
  const FORCE_BOUNDARY_POS = 0.9 * MAX_POS;
  const MAX_FORCE = 5.0 * MAX_ACCEL;

  // acceleration handling
  let u = 0.0;
  if (keys.right) u = MAX_ACCEL;
  if (keys.left) u = -MAX_ACCEL;

  // velocity limits
  if (x[1] > MAX_VEL) {
    u = u > 0.0 ? 0.0 : u;
  }
  if (x[1] < -MAX_VEL) {
    u = u < 0.0 ? 0.0 : u;
  }

  // force boundary
  if (x[0] > FORCE_BOUNDARY_POS && x[1] > 0.0) {
    u -= scaleValue(x[0], FORCE_BOUNDARY_POS, MAX_POS, 0, MAX_FORCE);
  }
  if (x[0] < -FORCE_BOUNDARY_POS && x[1] < 0.0) {
    u += scaleValue(x[0], -FORCE_BOUNDARY_POS, -MAX_POS, 0, MAX_FORCE);
  }

  // integrate dynamics
  let _x = [...x];
  if (dt) _x = integrate(x, u, dynamics, dt);

  return { x: _x, u: u };
}

module.exports = {
  dynamics,
  integrate,
  integratePendulumDynamics,
  scaleValue,
};
