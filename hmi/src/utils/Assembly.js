function Assembly(canvasWidth, canvasHeight) {
  // ********* DIMENSIONS *********
  // BLOCK
  const BLOCK_W = 42; // WIDTH
  const BLOCK_H = 21; // HEIGHT
  const BLOCK_O = 7; // HOLE LOCATION

  // LINEAR SHAFT
  const LIN_SHAFT_D = 8;
  const LINEAR_SHAFT_L = 486.475;

  // LINEAR BEARING MOUNT
  // const LINEAR_BEARING_WIDTH = 30;
  const LIN_BEARING_H = 22;
  const LIN_BEARING_O = 11;

  // CART MOUNTING PLATE
  const CART_PLATE_W = 37;
  const CART_PLATE_H = 6.35;

  // ROTARY BEARING MOUNT
  // const ROT_BEARING_W = 37;
  const ROT_BEARING_H = 23;
  // const ROT_BEARING_R = 9.525;
  const ROT_BEARING_O = 11;

  // ROTARY_SHAFT
  // const ROTARY_SHAFT_DIAMETER = 6.35;

  // PENDULUM
  const PEND_H = 304.8;
  const PEND_W = 18.745;
  const PEND_O = 8;
  const PEND_R = 5;

  // STEPPER_MOTOR
  const MOTOR_W = 42;
  const MOTOR_H = 39.3;

  // MAIN MOUNT
  const MAIN_MOUNT_W = 570.475;
  const MAIN_MOUNT_H = 9.525;

  // FEET_RISER
  // const FEET_RISER_WIDTH = 12.7;
  // const FEET_RISER_HEIGHT = 22.525;

  // FEET
  // const FEET_DIAMETER = 25.4;
  // const FEET_HEIGHT = 7.95;

  // MARGIN
  const MARGIN = 5;

  // Constructor
  const W = 2 * (MARGIN + PEND_H - 0.5 * CART_PLATE_W - PEND_O) + LINEAR_SHAFT_L; // TOTAL WIDTH
  const H = 2 * (MARGIN + PEND_H - PEND_O); // TOTAL HEIGHT
  this.x = 0;
  this.theta = 0;
  var pxPerMM = Math.min(canvasWidth / W, canvasHeight / H);

  // Update canvas size
  this.canvasSizeUpdate = function (canvasWidth, canvasHeight) {
    pxPerMM = Math.min(canvasWidth / W, canvasHeight / H);
    return [pxPerMM * W, pxPerMM * H];
  };

  // Update state
  this.updateState = function ({ x, theta }) {
    if (x) this.x = x;
    if (theta) this.theta = theta;
    const MAX_X_VALUE = (LINEAR_SHAFT_L - CART_PLATE_W) / 2.0;
    this.x = this.x < -MAX_X_VALUE ? -MAX_X_VALUE : this.x > MAX_X_VALUE ? MAX_X_VALUE : this.x;
  };

  // Fills a rectangle using mm dimensions and relative to the center
  CanvasRenderingContext2D.prototype.fillRectRelCenter = function (x, y, w, h) {
    this.fillRect(pxPerMM * (W / 2 + x), pxPerMM * (H / 2 + y), pxPerMM * w, pxPerMM * h);
  };

  // creates a rounded rect
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };

  // Main draw function
  this.draw = function (ctx) {
    // draw left block
    ctx.fillStyle = "SteelBlue";
    ctx.fillRectRelCenter(-LINEAR_SHAFT_L / 2.0 - BLOCK_W, ROT_BEARING_H - ROT_BEARING_O + CART_PLATE_H + LIN_BEARING_O - BLOCK_O, BLOCK_W, BLOCK_H);

    // draw main plate
    ctx.fillStyle = "DarkGrey";
    ctx.fillRectRelCenter(-LINEAR_SHAFT_L / 2.0 - BLOCK_W, ROT_BEARING_H - ROT_BEARING_O + CART_PLATE_H + LIN_BEARING_O - BLOCK_O + BLOCK_H, MAIN_MOUNT_W, MAIN_MOUNT_H);

    // draw right block
    ctx.fillStyle = "SteelBlue";
    ctx.fillRectRelCenter(LINEAR_SHAFT_L / 2.0, -ROT_BEARING_O + ROT_BEARING_H + CART_PLATE_H + LIN_BEARING_O - BLOCK_O, BLOCK_W, BLOCK_H);

    // draw stepper motor
    ctx.fillStyle = "black";
    ctx.fillRectRelCenter(LINEAR_SHAFT_L / 2.0, -ROT_BEARING_O + ROT_BEARING_H + CART_PLATE_H + LIN_BEARING_O - BLOCK_O - MOTOR_H, MOTOR_W, MOTOR_H);

    // draw linear shaft
    ctx.fillStyle = "DarkGrey";
    ctx.fillRectRelCenter(-LINEAR_SHAFT_L / 2.0, -ROT_BEARING_O + ROT_BEARING_H + CART_PLATE_H + LIN_BEARING_O - LIN_SHAFT_D / 2.0, LINEAR_SHAFT_L, LIN_SHAFT_D);

    // draw cart
    ctx.fillStyle = "Silver";
    ctx.fillRectRelCenter(this.x - CART_PLATE_W / 2, -ROT_BEARING_O, CART_PLATE_W, LIN_BEARING_H + CART_PLATE_H + ROT_BEARING_H);

    // draw pendulum
    ctx.fillStyle = "green";
    ctx.translate(pxPerMM * (W / 2 + this.x), pxPerMM * (H / 2));
    ctx.rotate(this.theta);
    ctx.translate(-pxPerMM * (W / 2 + this.x), -pxPerMM * (H / 2));
    // ctx.fillRectRelCenter(this.x - PEND_W / 2, PEND_O - PEND_H, PEND_W, PEND_H);
    ctx.roundRect(pxPerMM * (W / 2 + this.x - PEND_W / 2), pxPerMM * (H / 2 + PEND_O - PEND_H), pxPerMM * PEND_W, pxPerMM * PEND_H, pxPerMM * PEND_R).fill();
    ctx.translate(pxPerMM * (W / 2 + this.x), pxPerMM * (H / 2));
    ctx.rotate(-this.theta);
    ctx.translate(-pxPerMM * (W / 2 + this.x), -pxPerMM * (H / 2));
  };
}

export default Assembly;
