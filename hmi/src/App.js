import "./App.css";
import Canvas from "./components/Canvas";
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
  return [x[1], u, x[3], (g * Math.sin(x[2]) + u * Math.cos(x[2])) / Le];
}

function integrate(x, u, xdot, dt) {
  const MAX_DT = 0.0001;
  const [xDot, vDot, thetaDot, omegaDot] = xdot(x, u);
  if (dt > MAX_DT) {
    return integrate(integrate(x, u, xdot, MAX_DT), u, xdot, dt - MAX_DT);
  } else {
    return [x[0] + xDot * dt, x[1] + vDot * dt, x[2] + thetaDot * dt, x[3] + omegaDot * dt];
  }
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
  var x = [0, 0, 0.0, 0];
  const draw = (ctx, t) => {
    [ctx.canvas.width, ctx.canvas.height] = assembly.canvasSizeUpdate(window.innerWidth, window.innerHeight);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    assembly.draw(ctx);

    let currentTime = Number(t / 1000);
    let deltaTime = currentTime - prevTime;
    const MAX_VEL = 300.0;
    const MAX_POS = 224.5;
    const ACCEL = 1500.0;
    if (arrowRightPressedRef.current && !arrowLeftPressedRef.current) {
      uRef.current = ACCEL;
    } else if (!arrowRightPressedRef.current && arrowLeftPressedRef.current) {
      uRef.current = -ACCEL;
    } else {
      uRef.current = 0.0;
    }
    if (x[1] > MAX_VEL) {
      x[1] = MAX_VEL;
      // uRef.current = 0.0;
    }
    if (x[1] < -MAX_VEL) {
      x[1] = -MAX_VEL;
      // uRef.current = 0.0;
    }
    if (x[0] > MAX_POS) {
      x[0] = MAX_POS;
      x[1] = 0.0;
    }
    if (x[0] < -MAX_POS) {
      x[0] = -MAX_POS;
      x[1] = 0.0;
    }
    x = deltaTime ? integrate(x, uRef.current, pendulumDynamics, deltaTime) : x;
    assembly.updateState({ x: x[0], theta: x[2] });
    prevTime = currentTime;
  };

  return (
    <>
      <Canvas draw={draw} />
      <p>{uRef.current}</p>
    </>
  );
}

export default App;
