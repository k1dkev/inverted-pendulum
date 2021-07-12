function dynamics(x, u) {
  // x = [x,v,theta, w]
  const Le = 197.21; // m
  const g = 9810; // m/s^2
  const b = 0.25; //
  return [x[1], u, x[3], (g * Math.sin(x[2]) - u * Math.cos(x[2])) / Le - b * x[3]];
}

function integrate(x, u, xdot, dt) {
  const MAX_DT = 0.0001;
  let _dt = dt;
  let _x = x;
  let _u = u;
  while (_dt > 0.0) {
    let _xdot = xdot(_x, _u);
    let DT = _dt > MAX_DT ? MAX_DT : _dt;
    for (let i = 0; i < _x.length; i++) {
      _x[i] += _xdot[i] * DT;
    }
    _dt -= DT;
  }
  return _x;
}

module.exports = {
  dynamics,
  integrate,
};
