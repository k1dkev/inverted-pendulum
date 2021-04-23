import "./App.css";
import Canvas from "./components/Canvas";
// import { useState } from "react";

function Cart({ x, y, w, h }) {
  this.state = { x: x, y: y, w: w, h: h };
  this.draw = function (ctx) {
    ctx.fillStyle = "silver";
    ctx.fillRect(
      this.state.x - this.state.w / 2,
      this.state.y - this.state.h / 2,
      this.state.w,
      this.state.h
    );
  };
  this.update = function (ctx, { x, y, w, h }) {
    this.state = { x: x, y: y, w: w, h: h };
    this.draw(ctx);
  };
}

function Pendulum({ x, y, theta, w, h }) {
  this.state = { x: x, y: y, theta: theta, w: w, h: h };
  this.draw = function (ctx) {
    ctx.fillStyle = "green";
    ctx.translate(this.state.x, this.state.y);
    ctx.rotate(this.state.theta + Math.PI);
    ctx.translate(-this.state.x, -this.state.y);
    ctx.fillRect(
      this.state.x - this.state.w / 2,
      this.state.y - this.state.h / 20,
      this.state.w,
      this.state.h
    );
  };
  this.update = function (ctx, { x, y, theta, w, h }) {
    this.state = { x: x, y: y, theta: theta, w: w, h: h };
    this.draw(ctx);
  };
}

function App() {
  var cart = new Cart({ x: 0, y: 300, w: 100, h: 50 });
  var pendulum = new Pendulum({ x: 0, y: 300, theta: 0, w: 25, h: 200 });
  const draw = (ctx, frameCount) => {
    ctx.canvas.width = window.innerWidth;
    ctx.canvas.height = window.innerHeight / 2;
    let frameCountMod = frameCount % ctx.canvas.width;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    cart.update(ctx, { ...cart.state, x: frameCountMod });
    pendulum.update(ctx, {
      ...pendulum.state,
      x: frameCountMod,
      theta: (2 * Math.PI * frameCount) / ctx.canvas.width,
    });
  };

  return <Canvas draw={draw} />;
}

export default App;
