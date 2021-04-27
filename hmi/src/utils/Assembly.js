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

  this.x = 0;
  this.theta = 0;

  let pxmmWidth = canvasWidth / this.totalWidth; // pxmm = pixels per mm
  let pxmmHeight = canvasHeight / this.totalHeight;
  this.pxmm = pxmmWidth >= pxmmHeight ? pxmmHeight : pxmmWidth;
  this.widthPx = this.pxmm * this.totalWidth; // unneeded
  this.heightPx = this.pxmm * this.totalHeight; // unneeded

  this.canvasSizeUpdate = function (canvasWidth, canvasHeight) {
    let pxmmWidth = canvasWidth / this.totalWidth; // pxmm = pixels per mm
    let pxmmHeight = canvasHeight / this.totalHeight;
    this.pxmm = pxmmWidth >= pxmmHeight ? pxmmHeight : pxmmWidth;
  };

  // Fills a rectangle using mm dimensions
  this.fillRect = function (x, y, w, h) {
    this.ctx.fillRect(
      this.pxmm * x,
      this.pxmm * y,
      this.pxmm * w,
      this.pxmm * h
    );
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
    ctx.fillStyle = "Silver";
    this.fillRectRelCenter(
      this.x - dims.CART_MOUNT_PLATE_WIDTH / 2,
      -dims.ROTARY_BEARING_MOUNT_HOLE_LOCATION,
      dims.CART_MOUNT_PLATE_WIDTH,
      dims.LINEAR_BEARING_HEIGHT +
        dims.CART_MOUNT_PLATE_HEIGHT +
        dims.ROTARY_BEARING_MOUNT_HEIGHT
    );
  };

  this.drawPendulum = function (ctx) {
    ctx.fillStyle = "green";
    this.fillRectRelCenter(
      this.x - dims.PENDULUM_WIDTH / 2,
      dims.PENDULUM_HOLE_LOCATION - dims.PENDULUM_HEIGHT,
      dims.PENDULUM_WIDTH,
      dims.PENDULUM_HEIGHT
    );
  };

  this.drawLeftBlock = function (ctx) {
    ctx.fillStyle = "SteelBlue";
    this.fillRectRelCenter(
      -dims.LINEAR_SHAFT_LENGTH / 2.0 - dims.BLOCK_WIDTH,
      dims.ROTARY_BEARING_MOUNT_HEIGHT -
        dims.ROTARY_BEARING_MOUNT_HOLE_LOCATION +
        dims.CART_MOUNT_PLATE_HEIGHT +
        dims.LINEAR_BEARING_HOLE_LOCATION -
        dims.BLOCK_HOLE_LOCATION,
      dims.BLOCK_WIDTH,
      dims.BLOCK_HEIGHT
    );
  };

  this.drawRightBlock = function (ctx) {
    ctx.fillStyle = "SteelBlue";
    this.fillRectRelCenter(
      dims.LINEAR_SHAFT_LENGTH / 2.0,
      -dims.ROTARY_BEARING_MOUNT_HOLE_LOCATION +
        dims.ROTARY_BEARING_MOUNT_HEIGHT +
        dims.CART_MOUNT_PLATE_HEIGHT +
        dims.LINEAR_BEARING_HOLE_LOCATION -
        dims.BLOCK_HOLE_LOCATION,
      dims.BLOCK_WIDTH,
      dims.BLOCK_HEIGHT
    );
  };

  this.drawLinearShaft = function (ctx) {
    ctx.fillStyle = "DarkGrey";
    this.fillRectRelCenter(
      -dims.LINEAR_SHAFT_LENGTH / 2.0,
      -dims.ROTARY_BEARING_MOUNT_HOLE_LOCATION +
        dims.ROTARY_BEARING_MOUNT_HEIGHT +
        dims.CART_MOUNT_PLATE_HEIGHT +
        dims.LINEAR_BEARING_HOLE_LOCATION -
        dims.LINEAR_SHAFT_DIAMETER / 2.0,
      dims.LINEAR_SHAFT_LENGTH,
      dims.LINEAR_SHAFT_DIAMETER
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

export default Assembly;
