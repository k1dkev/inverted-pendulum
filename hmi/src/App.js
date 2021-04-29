import "./App.css";
import Canvas from "./components/Canvas";
import Assembly from "./utils/Assembly";
import { useState, useRef } from "react";
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
  const Le = 0.19721; // m
  const g = 9.81; // m/s^2
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
  // const square = new Rectangle(5, 10);
  // console.log(square.area); // 100

  //var _theta = Math.PI;
  var assembly = new Assembly(window.innerWidth, window.innerHeight);
  var prevTime = 0;
  var theta = Math.PI;
  var x = [0, 0, Math.PI / 3, 0];
  console.log(pendulumDynamics(x, 0));
  const draw = (ctx, t) => {
    [ctx.canvas.width, ctx.canvas.height] = assembly.canvasSizeUpdate(window.innerWidth, window.innerHeight);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    assembly.draw(ctx);
    let currentTime = Number(t / 1000);
    let deltaTime = currentTime - prevTime;
    // theta = deltaTime ? theta + deltaTime : theta;
    x = deltaTime ? integrate(x, 0, pendulumDynamics, deltaTime) : x;

    assembly.updateState({ theta: x[2] });
    prevTime = currentTime;
  };

  return <Canvas draw={draw} />;
}

export default App;
