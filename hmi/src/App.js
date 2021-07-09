import "./App.css";
import Canvas from "./components/Canvas";
import Plot from "./components/Plot";
import ChartPlot from "./components/ChartPlot";
import Assembly from "./utils/Assembly";
// import { useState, useRef } from "react";
import { useEffect, useRef } from "react";

// class Rectangle {
//   #height = 0;
//   #width;
//   constructor(height, width) {
//     this.#height = height;
//     this.#width = width;
//   }
//   // Getter
//   get area() {
//     return this.calcArea();
//   }
//   // Method
//   calcArea() {
//     return this.#height * this.#width;
//   }
// }

function pendulumDynamics(x, u) {
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
  let _xdot;
  while (_dt > MAX_DT) {
    _xdot = xdot(_x, _u);
    _x[0] = _x[0] + _xdot[0] * MAX_DT;
    _x[1] = _x[1] + _xdot[1] * MAX_DT;
    _x[2] = _x[2] + _xdot[2] * MAX_DT;
    _x[3] = _x[3] + _xdot[3] * MAX_DT;
    _dt -= MAX_DT;
  }
  _xdot = xdot(_x, _u);
  _x[0] = _x[0] + _xdot[0] * MAX_DT;
  _x[1] = _x[1] + _xdot[1] * MAX_DT;
  _x[2] = _x[2] + _xdot[2] * MAX_DT;
  _x[3] = _x[3] + _xdot[3] * MAX_DT;
  return _x;
}

function App() {
  const uRef = useRef(0);
  const arrowRightPressedRef = useRef(false);
  const arrowLeftPressedRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      switch (event.key) {
        case "ArrowRight":
          arrowRightPressedRef.current = true;
          break;
        case "ArrowLeft":
          arrowLeftPressedRef.current = true;
          break;
        default:
        //do nothing
      }
    };

    const handleKeyUp = (event) => {
      switch (event.key) {
        case "ArrowRight":
          arrowRightPressedRef.current = false;
          break;
        case "ArrowLeft":
          arrowLeftPressedRef.current = false;
          break;
        default:
        //do nothing
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  var assembly = new Assembly(window.innerWidth, window.innerHeight);
  var prevTime = 0;
  var x = [0, 0, 0, 0];
  function getData() {
    return x[0];
  }

  const draw = (ctx, t) => {
    [ctx.canvas.width, ctx.canvas.height] = assembly.canvasSizeUpdate(window.innerWidth - 2, window.innerHeight);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    assembly.draw(ctx);

    let currentTime = Number(t / 1000);
    let deltaTime = currentTime - prevTime;
    const MAX_VEL = 400.0;
    const MAX_POS = 224.5;
    const ACCEL = 3000.0;
    if (arrowRightPressedRef.current && !arrowLeftPressedRef.current) {
      uRef.current = ACCEL;
    } else if (!arrowRightPressedRef.current && arrowLeftPressedRef.current) {
      uRef.current = -ACCEL;
    } else {
      uRef.current = 0.0;
    }
    if (x[1] > MAX_VEL) {
      x[1] = MAX_VEL;
    }
    if (x[1] < -MAX_VEL) {
      x[1] = -MAX_VEL;
    }
    if (x[0] > MAX_POS) {
      x[0] = MAX_POS;
      x[1] = 0.0;
    }
    if (x[0] < -MAX_POS) {
      x[0] = -MAX_POS;
      x[1] = 0.0;
    }
    if (x[1] > 0.999 * MAX_VEL || x[0] > 0.999 * MAX_POS) {
      uRef.current = uRef.current > 0.0 ? 0.0 : uRef.current;
    }
    if (x[1] < -0.999 * MAX_VEL || x[0] < -0.999 * MAX_POS) {
      uRef.current = uRef.current < 0.0 ? 0.0 : uRef.current;
    }

    x = deltaTime ? integrate(x, uRef.current, pendulumDynamics, deltaTime) : x;
    assembly.updateState({ x: x[0], theta: x[2] });
    prevTime = currentTime;
  };

  return (
    <>
      <Canvas draw={draw} />
      <ChartPlot getData={getData} />
      {/* <Plot getData={getData} /> */}
      <p>{uRef.current}</p>
    </>
  );
}

export default App;
