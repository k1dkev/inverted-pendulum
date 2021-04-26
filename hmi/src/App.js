import "./App.css";
import Canvas from "./components/Canvas";
// import { useState } from "react";

function Assembly(canvasWidth, canvasHeight) {
  // Dimensions in mm
  const dims = {
    // BLOCK
    BLOCK_WIDTH: 42,
    BLOCK_HEIGHT: 21,
    BLOCK_HOLE_LOCATION: 7,

    // LINEAR_SHAFT
    LINEAR_SHAFT_DIAMETER: 8,
    LINEAR_SHAFT_LENGTH: 486.475,

    // LINEAR_BEARING
    LINEAR_BEARING_WIDTH: 30,
    LINEAR_BEARING_HEIGHT: 22,
    LINEAR_BEARING_HOLE_LOCATION: 11,

    // CART_MOUNT_PLATE
    CART_MOUNT_PLATE_WIDTH: 37,
    CART_MOUNT_PLATE_HEIGHT: 6.35,

    // ROTARY_BEARING_MOUNT
    ROTARY_BEARING_MOUNT_WIDTH: 37,
    ROTARY_BEARING_MOUNT_HEIGHT: 23,
    ROTARY_BEARING_MOUNT_RADIUS: 9.525,
    ROTARY_BEARING_MOUNT_HOLE_LOCATION: 11,

    // ROTARY_SHAFT
    ROTARY_SHAFT_DIAMETER: 6.35,

    // PENDULUM
    PENDULUM_HEIGHT: 304.8,
    PENDULUM_WIDTH: 18.745,
    PENDULUM_HOLE_LOCATION: 8,

    // STEPPER_MOTOR
    STEPPER_MOTOR_WIDTH: 42,
    STEPPER_MOTOR_HEIGHT: 39.3,

    // FEET_RISER
    FEET_RISER_WIDTH: 12.7,
    FEET_RISER_HEIGHT: 22.525,

    // FEET
    FEET_DIAMETER: 25.4,
    FEET_HEIGHT: 7.95,

    // MARGIN
    MARGIN: 40,
  };

  this.widthMM =
    2 *
      (dims.MARGIN +
        dims.PENDULUM_HEIGHT -
        0.5 * dims.CART_MOUNT_PLATE_WIDTH -
        dims.PENDULUM_HOLE_LOCATION) +
    dims.LINEAR_SHAFT_LENGTH;

  this.heightMM =
    2 * (dims.MARGIN + dims.PENDULUM_HEIGHT - dims.PENDULUM_HOLE_LOCATION) +
    dims.LINEAR_SHAFT_LENGTH;

  // this.determineScaling = function (canvasWidth, canvasHeight) {
  let pxmmWidth = canvasWidth / this.widthMM; // pxmm = pixels per mm
  let pxmmHeight = canvasHeight / this.heightMM;
  this.pxmm = pxmmWidth >= pxmmHeight ? pxmmHeight : pxmmWidth;
  this.widthPx = this.pxmm * this.widthMM;
  this.heightPx = this.pxmm * this.heightMM;
  // };

  this.drawCart = function (ctx) {
    let x = 0;
    ctx.fillStyle = "Silver";
    ctx.fillRect(
      this.widthPx / 2 + this.pxmm * (x - dims.CART_MOUNT_PLATE_WIDTH / 2),
      this.heightPx / 2 - this.pxmm * dims.ROTARY_BEARING_MOUNT_HOLE_LOCATION,
      this.pxmm * dims.CART_MOUNT_PLATE_WIDTH,
      this.pxmm *
        (dims.LINEAR_BEARING_HEIGHT +
          dims.CART_MOUNT_PLATE_HEIGHT +
          dims.ROTARY_BEARING_MOUNT_HEIGHT)
    );
  };

  this.drawPendulum = function (ctx) {
    let x = 0;
    ctx.fillStyle = "green";
    ctx.fillRect(
      this.widthPx / 2 + this.pxmm * (x - dims.PENDULUM_WIDTH / 2),
      this.heightPx / 2 +
        this.pxmm * (dims.PENDULUM_HOLE_LOCATION - dims.PENDULUM_HEIGHT),
      this.pxmm * dims.PENDULUM_WIDTH,
      this.pxmm * dims.PENDULUM_HEIGHT
    );
  };

  this.drawLeftBlock = function (ctx) {
    ctx.fillStyle = "SteelBlue";
    ctx.fillRect(
      this.widthPx / 2 -
        this.pxmm * (dims.LINEAR_SHAFT_LENGTH / 2.0 + dims.BLOCK_WIDTH),
      this.heightPx / 2 +
        this.pxmm *
          (-dims.ROTARY_BEARING_MOUNT_HOLE_LOCATION +
            dims.ROTARY_BEARING_MOUNT_HEIGHT +
            dims.CART_MOUNT_PLATE_HEIGHT +
            dims.LINEAR_BEARING_HOLE_LOCATION -
            dims.BLOCK_HOLE_LOCATION),
      this.pxmm * dims.BLOCK_WIDTH,
      this.pxmm * dims.BLOCK_HEIGHT
    );
  };

  this.drawRightBlock = function (ctx) {
    ctx.fillStyle = "SteelBlue";
    ctx.fillRect(
      this.widthPx / 2 + this.pxmm * (dims.LINEAR_SHAFT_LENGTH / 2.0),
      this.heightPx / 2 +
        this.pxmm *
          (-dims.ROTARY_BEARING_MOUNT_HOLE_LOCATION +
            dims.ROTARY_BEARING_MOUNT_HEIGHT +
            dims.CART_MOUNT_PLATE_HEIGHT +
            dims.LINEAR_BEARING_HOLE_LOCATION -
            dims.BLOCK_HOLE_LOCATION),
      this.pxmm * dims.BLOCK_WIDTH,
      this.pxmm * dims.BLOCK_HEIGHT
    );
  };

  this.drawLinearShaft = function (ctx) {
    ctx.fillStyle = "DarkGrey";
    ctx.fillRect(
      this.widthPx / 2 - this.pxmm * (dims.LINEAR_SHAFT_LENGTH / 2.0),
      this.heightPx / 2 +
        this.pxmm *
          (-dims.ROTARY_BEARING_MOUNT_HOLE_LOCATION +
            dims.ROTARY_BEARING_MOUNT_HEIGHT +
            dims.CART_MOUNT_PLATE_HEIGHT +
            dims.LINEAR_BEARING_HOLE_LOCATION -
            dims.LINEAR_SHAFT_DIAMETER / 2.0),
      this.pxmm * dims.LINEAR_SHAFT_LENGTH,
      this.pxmm * dims.LINEAR_SHAFT_DIAMETER
    );
  };

  this.draw = function (ctx) {
    this.drawLeftBlock(ctx);
    this.drawRightBlock(ctx);
    this.drawLinearShaft(ctx);
    this.drawCart(ctx);
    this.drawPendulum(ctx);
  };

  //   this.draw = function (ctx) {
  //     ctx.fillStyle = "DarkGrey";
  //     ctx.fillRect(
  //       this.state.x - this.state.w / 2,
  //       this.state.y - this.state.h / 2,
  //       this.state.w,
  //       this.state.h
  //     );
  //   };
}

// function Cart({ x, y, w, h }) {
//   this.state = { x: x, y: y, w: w, h: h };
//   this.draw = function (ctx) {
//     ctx.fillStyle = "silver";
//     ctx.fillRect(
//       this.state.x - this.state.w / 2,
//       this.state.y - this.state.h / 2,
//       this.state.w,
//       this.state.h
//     );
//   };
//   this.update = function (ctx, { x, y, w, h }) {
//     this.state = { x: x, y: y, w: w, h: h };
//     this.draw(ctx);
//   };
// }

// function Pendulum({ x, y, theta, w, h }) {
//   this.state = { x: x, y: y, theta: theta, w: w, h: h };
//   this.draw = function (ctx) {
//     ctx.fillStyle = "green";
//     ctx.translate(this.state.x, this.state.y);
//     ctx.rotate(this.state.theta + Math.PI);
//     ctx.translate(-this.state.x, -this.state.y);
//     ctx.fillRect(
//       this.state.x - this.state.w / 2,
//       this.state.y - this.state.h / 20,
//       this.state.w,
//       this.state.h
//     );
//   };
//   this.update = function (ctx, { x, y, theta, w, h }) {
//     this.state = { x: x, y: y, theta: theta, w: w, h: h };
//     this.draw(ctx);
//   };
// }

// function Rail({ x, y, w, h }) {
//   this.state = { x: x, y: y, w: w, h: h };
//   this.draw = function (ctx) {
//     ctx.fillStyle = "DarkGrey";
//     ctx.fillRect(
//       this.state.x - this.state.w / 2,
//       this.state.y - this.state.h / 2,
//       this.state.w,
//       this.state.h
//     );
//   };
//   this.update = function (ctx, { x, y, theta, w, h }) {
//     this.state = { x: x, y: y, theta: theta, w: w, h: h };
//     this.draw(ctx);
//   };
// }

// function Block({ x, y, w, h }) {
//   this.state = { x: x, y: y, w: w, h: h };
//   this.draw = function (ctx) {
//     ctx.fillStyle = "SteelBlue";
//     ctx.fillRect(
//       this.state.x - this.state.w / 2,
//       this.state.y - this.state.h / 2,
//       this.state.w,
//       this.state.h
//     );
//   };
//   this.update = function (ctx, { x, y, theta, w, h }) {
//     this.state = { x: x, y: y, theta: theta, w: w, h: h };
//     this.draw(ctx);
//   };
// }

function App() {
  // var cart = new Cart({ x: 0, y: 200, w: 100, h: 50 });
  // var pendulum = new Pendulum({ x: 0, y: 200, theta: 0, w: 20, h: 200 });
  // var rail = new Rail({ x: window.innerWidth / 2, y: 200, w: 900, h: 20 });
  // var leftBlock = new Block({
  //   x: window.innerWidth / 2 - rail.state.w / 2 - 25,
  //   y: 200 + 10,
  //   w: 50,
  //   h: 60,
  // });
  // var rightBlock = new Block({
  //   x: window.innerWidth / 2 + rail.state.w / 2 + 25,
  //   y: 200 + 10,
  //   w: 50,
  //   h: 60,
  // });

  var assembly = new Assembly(window.innerWidth, window.innerHeight);
  console.log(window.innerWidth, window.innerHeight);
  const draw = (ctx, frameCount) => {
    // ctx.canvas.width = window.innerWidth;
    // ctx.canvas.height = window.innerHeight / 2;

    ctx.canvas.width = assembly.widthPx;
    ctx.canvas.height = assembly.heightPx;
    // console.log(assembly.widthMM, assembly.heightMM);
    // let frameCountMod = frameCount % ctx.canvas.width;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    assembly.draw(ctx);
    // rail.update(ctx, rail.state);
    // leftBlock.update(ctx, leftBlock.state);
    // rightBlock.update(ctx, rightBlock.state);
    // cart.update(ctx, { ...cart.state, x: frameCountMod });
    // pendulum.update(ctx, {
    //   ...pendulum.state,
    //   x: frameCountMod,
    //   theta: (2 * Math.PI * frameCount) / ctx.canvas.width,
    // });
  };

  return <Canvas draw={draw} />;
}

export default App;
