function Assembly(pxPerMM) {
  // ********* DIMENSIONS *********
  // BLOCK
  const BLOCK_W = 42; // WIDTH
  const BLOCK_H = 21; // HEIGHT
  const BLOCK_O = 7; // HOLE LOCATION

  // LINEAR SHAFT
  const LIN_SHAFT_D = 8;
  const LINEAR_SHAFT_L = 486.475;

  // LINEAR BEARING MOUNT
  const LIN_BEARING_W = 30;
  const LIN_BEARING_H = 22;
  const LIN_BEARING_O = 11;

  // CART MOUNTING PLATE
  const CART_PLATE_W = 37;
  const CART_PLATE_H = 6.35;

  // ROTARY BEARING MOUNT
  const ROT_BEARING_W = 37;
  const ROT_BEARING_H = 23;
  const ROT_BEARING_R = 9.525;
  const ROT_BEARING_O = 11;

  // ROTARY_SHAFT
  const ROT_SHAFT_D = 6.35;

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
  const FEET_RISER_W = 12.7;
  const FEET_RISER_H = 22.525;

  // FEET
  const FEET_D = 25.4;
  const FEET_H = 7.95;

  // MARGIN
  const MARGIN = 5;

  // Constructor
  const W = 1.35 * (MARGIN + PEND_H - 0.5 * CART_PLATE_W - PEND_O) + LINEAR_SHAFT_L; // TOTAL WIDTH (Note that 2x makes it so that nothing is cut off)
  const H = 1.35 * (MARGIN + PEND_H - PEND_O); // TOTAL HEIGHT (Note that 2x makes it so that nothing is cut off)
  this.x = 0;
  this.theta = 0;
  var canvasSizeSet = false;

  // Update state
  this.updateState = function ({ x, theta }) {
    if (x) this.x = x;
    if (theta) this.theta = theta;
  };

  // creates a rounded rectangle
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

  // For calling ctx functions and applying scaling and shifting
  CanvasRenderingContext2D.prototype.shiftScaleCall = function (ctxFcn, ...args) {
    args[0] = args[0] + W / 2;
    args[1] = args[1] + (3 * H) / 4; // 3/4 shifts the center down
    ctxFcn.call(this, ...args.map((arg) => pxPerMM * arg));
    return this;
  };

  // For calling ctx functions and applying scaling and shifting
  CanvasRenderingContext2D.prototype.circle = function (x, y, r) {
    this.beginPath();
    this.arc(x, y, r, 0, 2 * Math.PI);
    this.stroke();
    return this;
  };

  // Main draw function
  this.draw = function (ctx) {
    // Clear canvas (canvas clears when setting the width and height)
    if (!canvasSizeSet) {
      ctx.canvas.width = pxPerMM * W;
      ctx.canvas.height = pxPerMM * H;
      canvasSizeSet = true;
    }
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // draw left block
    ctx.fillStyle = "SteelBlue";
    ctx.shiftScaleCall(ctx.fillRect, -LINEAR_SHAFT_L / 2.0 - BLOCK_W, ROT_BEARING_H - ROT_BEARING_O + CART_PLATE_H + LIN_BEARING_O - BLOCK_O, BLOCK_W, BLOCK_H);

    // draw main plate
    ctx.fillStyle = "DarkGrey";
    ctx.shiftScaleCall(ctx.fillRect, -LINEAR_SHAFT_L / 2.0 - BLOCK_W, ROT_BEARING_H - ROT_BEARING_O + CART_PLATE_H + LIN_BEARING_O - BLOCK_O + BLOCK_H, MAIN_MOUNT_W, MAIN_MOUNT_H);

    // draw right block
    ctx.fillStyle = "SteelBlue";
    ctx.shiftScaleCall(ctx.fillRect, LINEAR_SHAFT_L / 2.0, -ROT_BEARING_O + ROT_BEARING_H + CART_PLATE_H + LIN_BEARING_O - BLOCK_O, BLOCK_W, BLOCK_H);

    // draw stepper motor
    ctx.fillStyle = "black";
    ctx.shiftScaleCall(ctx.fillRect, LINEAR_SHAFT_L / 2.0, -ROT_BEARING_O + ROT_BEARING_H + CART_PLATE_H + LIN_BEARING_O - BLOCK_O - MOTOR_H, MOTOR_W, MOTOR_H);

    // draw linear shaft
    ctx.fillStyle = "DarkGrey";
    ctx.shiftScaleCall(ctx.fillRect, -LINEAR_SHAFT_L / 2.0, -ROT_BEARING_O + ROT_BEARING_H + CART_PLATE_H + LIN_BEARING_O - LIN_SHAFT_D / 2.0, LINEAR_SHAFT_L, LIN_SHAFT_D);

    // draw feet risers
    ctx.fillStyle = "DarkGrey";
    for (let i = 0; i < 4; i++) {
      ctx.shiftScaleCall(
        ctx.fillRect,
        -LINEAR_SHAFT_L / 2.0 - BLOCK_W + ((MAIN_MOUNT_W - FEET_RISER_W) * i) / 3,
        ROT_BEARING_H - ROT_BEARING_O + CART_PLATE_H + LIN_BEARING_O - BLOCK_O + BLOCK_H + MAIN_MOUNT_H,
        FEET_RISER_W,
        FEET_RISER_H
      );
    }

    // draw feet
    ctx.fillStyle = "black";
    for (let i = 0; i < 4; i++) {
      ctx.shiftScaleCall(
        ctx.fillRect,
        -LINEAR_SHAFT_L / 2.0 - BLOCK_W + ((MAIN_MOUNT_W - FEET_RISER_W) * i) / 3 - FEET_D / 4,
        ROT_BEARING_H - ROT_BEARING_O + CART_PLATE_H + LIN_BEARING_O - BLOCK_O + BLOCK_H + MAIN_MOUNT_H + FEET_RISER_H,
        FEET_D,
        FEET_H
      );
    }

    // draw cart
    ctx.fillStyle = "Silver";
    ctx.shiftScaleCall(ctx.roundRect, this.x - ROT_BEARING_W / 2, -ROT_BEARING_O, ROT_BEARING_W, ROT_BEARING_H, ROT_BEARING_R).fill();
    ctx.shiftScaleCall(ctx.fillRect, this.x - ROT_BEARING_W / 2, -ROT_BEARING_O + ROT_BEARING_H / 2, ROT_BEARING_W, ROT_BEARING_H / 2);
    ctx.fillStyle = "DarkGrey";
    ctx.shiftScaleCall(ctx.fillRect, this.x - CART_PLATE_W / 2, -ROT_BEARING_O + ROT_BEARING_H, CART_PLATE_W, CART_PLATE_H);
    ctx.fillStyle = "Silver";
    ctx.shiftScaleCall(ctx.fillRect, this.x - LIN_BEARING_W / 2, -ROT_BEARING_O + ROT_BEARING_H + CART_PLATE_H, LIN_BEARING_W, LIN_BEARING_H);

    // draw pendulum
    ctx.fillStyle = "green";
    ctx.shiftScaleCall(ctx.translate, this.x, 0);
    ctx.rotate(this.theta);
    ctx.shiftScaleCall(ctx.translate, -W - this.x, (-3 * H) / 2); // 3/2 shifts the center down
    ctx.shiftScaleCall(ctx.roundRect, this.x - PEND_W / 2, PEND_O - PEND_H, PEND_W, PEND_H, PEND_R).fill();
    ctx.shiftScaleCall(ctx.translate, this.x, 0);
    ctx.rotate(-this.theta);
    ctx.shiftScaleCall(ctx.translate, -W - this.x, (-3 * H) / 2); // 3/2 shifts the center down
    ctx.fillStyle = "black";
    ctx.shiftScaleCall(ctx.circle, this.x, 0, ROT_SHAFT_D / 2).fill();
  };
}

export default Assembly;
