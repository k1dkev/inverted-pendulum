// import "./App.css";
// import Canvas from "../Canvas/Canvas";

//let myAxis = new kAxis();

class kAxis {
  constructor({
    textPx,
    axisThicknessPx,
    axisColor,
    tickLengthPx,
    numOfDecimals,
    numOfTicks,
    minValue,
    maxValue,
    showOutline,
    tickTextPadding,
  } = {}) {
    this.textPx = textPx || 20;
    this.axisThicknessPx = axisThicknessPx || 2;
    this.axisColor = axisColor || "#000000";
    this.tickLengthPx = tickLengthPx || 10;
    this.numOfDecimals = numOfDecimals || 0;
    this.numOfTicks = numOfTicks || 10;
    this.minValue = minValue || 0;
    this.maxValue = maxValue || 100;
    this.heightPx = 100; // provided to object
    this.tickLabels = [];
    this.updateTickLabels();
    this.widthPx = 50; // calculated by object
    this.showOutline = showOutline || false;
    this.xPx = 0; // provided to object
    this.yPx = 0; // provided to object
    this.axisLengthPx = 100; // calculated
    this.axisStartPx = 0;
    this.tickTextPadding = tickTextPadding || 1;
  }

  updateTickLabels() {
    let tickDelta = (this.maxValue - this.minValue) / (this.numOfTicks - 1);
    this.tickLabels = [];
    for (let i = 0; i < this.numOfTicks; i++) {
      let val = this.minValue + tickDelta * i;
      this.tickLabels.push(val.toFixed(this.numOfDecimals));
    }
  }

  calcParams(ctx) {
    // axis length
    this.axisLengthPx = this.heightPx - this.textPx;

    // axis start
    this.axisStartPx = this.heightPx - this.textPx / 2;

    // width
    let maxTextWidth = 0;
    for (let i = 0; i < this.numOfTicks; i++) {
      ctx.font = `${this.textPx}px Monospace`;
      let textWidth = Math.ceil(ctx.measureText(this.tickLabels[i]).width);
      maxTextWidth = textWidth > maxTextWidth ? textWidth : maxTextWidth;
    }

    this.widthPx = maxTextWidth + this.tickTextPadding + this.tickLengthPx;
  }

  drawOutline(ctx) {
    if (!this.showOutline) return;
    ctx.beginPath();
    ctx.rect(0.5, 0.5, this.widthPx, this.heightPx);
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawVerticalLine(ctx) {
    ctx.beginPath();
    ctx.moveTo(this.widthPx, this.axisStartPx);
    ctx.lineTo(this.widthPx, this.axisStartPx - this.axisLengthPx);
    ctx.lineWidth = this.axisThicknessPx;
    ctx.strokeStyle = "black";
    ctx.stroke();
  }

  drawTicks(ctx) {
    let tickDelta = this.axisLengthPx / (this.numOfTicks - 1);
    // draw ticks
    for (let i = 0; i < this.numOfTicks; i++) {
      ctx.beginPath();
      let x = this.widthPx;
      let y = this.axisStartPx - tickDelta * i;
      ctx.moveTo(x, y);
      ctx.lineTo(x - this.tickLengthPx, y);
      ctx.lineWidth = this.axisThicknessPx;
      ctx.strokeStyle = "black";
      ctx.stroke();
    }

    // draw tick labels
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i < this.numOfTicks; i++) {
      let x = this.widthPx - this.tickLengthPx - this.tickTextPadding;
      let y = this.axisStartPx - tickDelta * i;
      ctx.font = `${this.textPx}px Monospace`;
      ctx.fillText(this.tickLabels[i], x, y);
    }
  }

  draw(ctx) {
    this.calcParams(ctx);
    ctx.translate(this.xPx, this.yPx);
    this.drawOutline(ctx);
    this.drawVerticalLine(ctx);
    this.drawTicks(ctx);
    ctx.resetTransform();
  }
}

class TestCanvas {
  constructor({ numOfPoints, W, H, margin, aspectRatio } = {}) {
    this.aspectRatio = aspectRatio || 1.5;
    this.totalWidth = W || 1000;
    this.totalHeight = H || 1000;
    this.numOfPoints = numOfPoints || 100;
    this.margin = margin || 10;
    this.W = this.totalWidth - 2 * this.margin;
    this.H = this.totalHeight - 2 * this.margin;
    this.axis = new kAxis({ showOutline: true });
  }

  drawLine(ctx, t) {
    ctx.moveTo(0, this.H / 2);
    ctx.beginPath();
    for (let i = 0; i <= this.numOfPoints; i++) {
      let x = (i * this.W) / this.numOfPoints;
      let y = (this.H / 4) * Math.sin(x / 100 + t / 500) + this.H / 2;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  drawAroundCanvas(ctx, t) {
    // ctx.moveTo(0, this.H / 2);
    ctx.beginPath();
    ctx.rect(0.5, 0.5, this.totalWidth - 1, this.totalHeight - 1);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  draw(canvas, t) {
    let ctx = canvas.getContext("2d");
    this.totalWidth = canvas.offsetWidth;
    this.totalHeight = Math.ceil(canvas.offsetWidth / this.aspectRatio);
    ctx.canvas.width = this.totalWidth;
    ctx.canvas.height = this.totalHeight;
    this.W = this.totalWidth - 2 * this.margin;
    this.H = this.totalHeight - 2 * this.margin;

    // Draw line
    this.drawLine(ctx, t);

    // Draw canvas outline
    this.drawAroundCanvas(ctx, t);

    // draw axis
    this.axis.heightPx = this.totalHeight - 2 * this.margin;
    this.axis.xPx = this.margin;
    this.axis.yPx = this.margin;
    this.axis.draw(ctx);
  }
}

export default TestCanvas;

/*
params:
Num of data points
time length to save over
Num of axes

inputs
getData -> will return an array of (name,value) pairs
frequency -> How often the data should be pulled
time length -> Length of time to save data points for

outputs
names -> list of names
toggleCallback(name) -> will toggle the display of the 

edge cases
name stops pulling

potential things to plot u, x, v, /theta, /theta_dot

*/
