import { useRef } from "react";
import pendulum from "../utils/Pendulum";

const MAX_ACCEL = 3000.0;
const MAX_VEL = 400.0;
const MAX_POS = 224.5;

const usePendSimulation = () => {
  const prevTimeRef = useRef(null);
  const xRef = useRef([0, 0, 0, 0]);
  const uRef = useRef(0);

  const updatePendState = (t, keys) => {
    // retrieve ref values
    let x = xRef.current;
    let u = uRef.current;
    let prevTime = prevTimeRef.current;

    // time handling
    const currentTime = Number(t / 1000);
    if (!prevTime) prevTime = currentTime;
    const deltaTime = currentTime - prevTime;
    prevTime = currentTime;

    // acceleration handling
    u = 0.0;
    if (keys.right) u = MAX_ACCEL;
    if (keys.left) u = -MAX_ACCEL;

    // position/velocity limits
    if (x[1] > MAX_VEL) x[1] = MAX_VEL;
    if (x[1] < -MAX_VEL) x[1] = -MAX_VEL;
    if (x[0] > MAX_POS) x[0] = MAX_POS;
    if (x[0] > MAX_POS) x[1] = 0.0;
    if (x[0] < -MAX_POS) x[0] = -MAX_POS;
    if (x[0] < -MAX_POS) x[1] = 0.0;
    if (x[1] > 0.999 * MAX_VEL || x[0] > 0.999 * MAX_POS) u = u > 0.0 ? 0.0 : u;
    if (x[1] < -0.999 * MAX_VEL || x[0] < -0.999 * MAX_POS) u = u < 0.0 ? 0.0 : u;

    // integrate dynamics
    if (deltaTime) x = pendulum.integrate(x, u, pendulum.dynamics, deltaTime);

    // update refs
    xRef.current = x;
    uRef.current = u;
    prevTimeRef.current = prevTime;

    return { x: x, u: u };
  };

  return updatePendState;
};

export default usePendSimulation;

// import { useRef, useEffect, useState } from "react";
// import pendulum from "../utils/Pendulum";

// const MAX_ACCEL = 3000.0;
// const MAX_VEL = 400.0;
// const MAX_POS = 224.5;

// const usePendSimulation = () => {
//   const [prevTime, setPrevTime] = useState(null);
//   const [state, setState] = useState([0, 0, 0, 0]);
//   const [u, setU] = useState(0);

//   const updatePendState = (t, keys) => {
//     // time handling
//     if (!prevTime) setPrevTime(t);
//     const deltaTime = t - prevTime;
//     setPrevTime(t);

//     // retrieve state
//     let x = state;

//     // acceleration handling
//     setU(0.0);
//     if (keys.right) setU(MAX_ACCEL);
//     if (keys.left) setU(-MAX_ACCEL);

//     // position/velocity limits
//     if (x[1] > MAX_VEL) x[1] = MAX_VEL;
//     if (x[1] < -MAX_VEL) x[1] = -MAX_VEL;
//     if (x[0] > MAX_POS) x[0] = MAX_POS;
//     if (x[0] > MAX_POS) x[1] = 0.0;
//     if (x[0] < -MAX_POS) x[0] = -MAX_POS;
//     if (x[0] < -MAX_POS) x[1] = 0.0;
//     if (x[1] > 0.999 * MAX_VEL || x[0] > 0.999 * MAX_POS) setU(u > 0.0 ? 0.0 : u);
//     if (x[1] < -0.999 * MAX_VEL || x[0] < -0.999 * MAX_POS) setU(u < 0.0 ? 0.0 : u);

//     // integrate dynamics
//     if (deltaTime) x = pendulum.integrate(x, u, pendulum.dynamics, deltaTime);
//     setState(x);

//     return { x: state, u: u };
//   };

//   return updatePendState;
// };

// export default usePendSimulation;
