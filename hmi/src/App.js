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
    MARGIN: 5,
  };

  // Constructor
  this.totalWidth =
    2 *
      (dims.MARGIN +
        dims.PENDULUM_HEIGHT -
        0.5 * dims.CART_MOUNT_PLATE_WIDTH -
        dims.PENDULUM_HOLE_LOCATION) +
    dims.LINEAR_SHAFT_LENGTH;

  this.totalHeight =
    2 * (dims.MARGIN + dims.PENDULUM_HEIGHT - dims.PENDULUM_HOLE_LOCATION);

  // this.determineScaling = function (canvasWidth, canvasHeight) {
  let pxmmWidth = canvasWidth / this.totalWidth; // pxmm = pixels per mm
  let pxmmHeight = canvasHeight / this.totalHeight;
  this.pxmm = pxmmWidth >= pxmmHeight ? pxmmHeight : pxmmWidth;
  this.widthPx = this.pxmm * this.totalWidth; // unneeded
  this.heightPx = this.pxmm * this.totalHeight; // unneeded
  // };

  this.canvasSizeUpdate = function (canvasWidth, canvasHeight) {
    let pxmmWidth = canvasWidth / this.totalWidth; // pxmm = pixels per mm
    let pxmmHeight = canvasHeight / this.totalHeight;
    this.pxmm = pxmmWidth >= pxmmHeight ? pxmmHeight : pxmmWidth;
  };

  // Fills a rectangle using mm dimensions
  this.fillRect = function (ctx, x, y, w, h) {
    ctx.fillRect(this.pxmm * x, this.pxmm * y, this.pxmm * w, this.pxmm * h);
  };

  // Fills a rectangle using mm dimensions
  this.fillRectRelCenter = function (x, y, w, h) {
    this.ctx.fillRect(
      this.pxmm * (this.totalWidth / 2 + x),
      this.pxmm * (this.totalHeight / 2 + y),
      this.pxmm * w,
      this.pxmm * h
    );
  };

  this.drawCart = function (ctx) {
    let x = 0;
    ctx.fillStyle = "Silver";
    this.fillRectRelCenter(
      x - dims.CART_MOUNT_PLATE_WIDTH / 2,
      -dims.ROTARY_BEARING_MOUNT_HOLE_LOCATION,
      dims.CART_MOUNT_PLATE_WIDTH,
      dims.LINEAR_BEARING_HEIGHT +
        dims.CART_MOUNT_PLATE_HEIGHT +
        dims.ROTARY_BEARING_MOUNT_HEIGHT
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
    this.ctx = ctx;
    this.drawLeftBlock(ctx);
    this.drawRightBlock(ctx);
    this.drawLinearShaft(ctx);
    this.drawCart(ctx);
    this.drawPendulum(ctx);
  };
}

function App() {
  var assembly = new Assembly(window.innerWidth, window.innerHeight);
  console.log(window.innerWidth, window.innerHeight);
  const draw = (ctx, frameCount) => {
    // ctx.canvas.width = window.innerWidth;
    // ctx.canvas.height = window.innerHeight / 2;

    ctx.canvas.width = assembly.widthPx;
    ctx.canvas.height = assembly.heightPx;
    console.log(assembly.widthMM, assembly.heightMM);
    // let frameCountMod = frameCount % ctx.canvas.width;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    assembly.draw(ctx);
  };

  return <Canvas draw={draw} />;
}

export default App;
