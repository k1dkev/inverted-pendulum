// For calling ctx functions and applying scaling and shifting
CanvasRenderingContext2D.prototype.rectBorderInside = function (x, y, w, h, t) {
  this.rect(x, y, w, t); // top
  this.rect(x, y + h - t, w, t); // bottom
  this.rect(x, y, t, h); // left
  this.rect(x + w - t, y, t, h); // right
  return this;
};

//------------------------------------------------------------------------------------
//                                kAxis
//------------------------------------------------------------------------------------
class kAxis {
  #params;
  #config;
  constructor(config) {
    this.#config = {
      pos: {
        availableHeight: 100,
        x: 0,
        y: 0,
      },
      options: {
        showOutline: false,
      },
      text: {
        color: "#000000",
        height: 15,
        numOfDecimals: 0,
        padding: 1,
      },
      ticks: {
        color: "#000000",
        length: 5,
        count: 11,
        minEngValue: 0,
        maxEngValue: 500,
      },
      line: {
        color: "#000000",
        thickness: 2,
      },
    };

    this.updateConfig(config);

    this.#params = {
      pos: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
      ticks: {
        pos: {
          start: 0,
          end: 0,
          delta: 0,
        },
        labels: [],
      },
    };
  }

  updateConfig(config) {
    this.#config = { ...this.#config, ...config };
  }

  get params() {
    return { ...this.#params };
  }

  updateParams(ctx) {
    // tick deltas
    let engTickDelta =
      (this.#config.ticks.maxEngValue - this.#config.ticks.minEngValue) / (this.#config.ticks.count - 1);
    this.#params.ticks.labels = [];
    for (let i = 0; i < this.#config.ticks.count; i++) {
      let val = this.#config.ticks.minEngValue + engTickDelta * i;
      this.#params.ticks.labels.push(val.toFixed(this.#config.text.numOfDecimals));
    }

    // axis start / end
    this.#params.ticks.pos.start = this.#config.pos.availableHeight - this.#config.text.height / 2;
    this.#params.ticks.pos.end = this.#config.text.height / 2;
    this.#params.ticks.pos.delta =
      Math.abs(this.#params.ticks.pos.end - this.#params.ticks.pos.start) / (this.#config.ticks.count - 1);

    // Max text width
    ctx.font = `${this.#config.text.height}px Monospace`;
    let maxTextWidth = Math.ceil(
      Math.max(
        ...Array.from(
          Array(this.#config.ticks.count).keys(),
          (i) => ctx.measureText(this.#params.ticks.labels[i]).width
        )
      )
    );

    // Positions
    this.#params.pos.width =
      maxTextWidth + this.#config.text.padding + this.#config.ticks.length + this.#config.line.thickness;
    this.#params.pos.height = this.#config.pos.availableHeight;
    this.#params.pos.x = this.#config.pos.x;
    this.#params.pos.y = this.#config.pos.y;
  }

  drawOutline(ctx) {
    if (!this.#config.options.showOutline) return;
    ctx.beginPath();
    ctx.fillStyle = "blue";
    ctx.rectBorderInside(0, 0, this.#params.pos.width, this.#params.pos.height, 1);
    ctx.fill();
  }

  drawVerticalLine(ctx) {
    ctx.beginPath();
    ctx.lineWidth = this.#config.line.thickness;
    ctx.fillStyle = "black";
    ctx.rect(
      this.#params.pos.width - this.#config.line.thickness,
      0,
      this.#config.line.thickness,
      this.#params.pos.height
    );
    ctx.fill();
  }

  drawTicks(ctx) {
    for (let i = 0; i < this.#config.ticks.count; i++) {
      ctx.beginPath();
      ctx.fillStyle = "black";
      ctx.rect(
        this.#params.pos.width - this.#config.ticks.length - this.#config.line.thickness,
        Math.round(this.#params.ticks.pos.start - this.#params.ticks.pos.delta * i - this.#config.line.thickness / 2),
        this.#config.ticks.length,
        this.#config.line.thickness
      );
      ctx.fill();
    }
  }

  drawTickLabels(ctx) {
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "black";
    ctx.font = `${this.#config.text.height}px Monospace`;
    for (let i = 0; i < this.#config.ticks.count; i++) {
      let x =
        this.#params.pos.width - this.#config.ticks.length - this.#config.text.padding - this.#config.line.thickness;
      let y = this.#params.ticks.pos.start - this.#params.ticks.pos.delta * i + 0.1 * this.#config.text.height;
      ctx.fillText(this.#params.ticks.labels[i], x, y);
    }
  }

  draw(ctx) {
    this.updateParams(ctx);
    ctx.translate(this.#params.pos.x, this.#params.pos.y);
    this.drawOutline(ctx);
    this.drawVerticalLine(ctx);
    this.drawTicks(ctx);
    this.drawTickLabels(ctx);
    ctx.resetTransform();
  }
}

//------------------------------------------------------------------------------------
//                                kAxis
//------------------------------------------------------------------------------------
// class kAxis {
//   constructor() {
//     // Main object
//     this.heightPx = 100; // provided to object
//     this.widthPx = 50; // calculated by object
//     this.xPx = 0; // provided to object
//     this.yPx = 0; // provided to object
//     this.showOutline = false;
//     this.axisStartPx = 0;
//     this.axisEndPx = 0; // need to implement
//     this.minValue = 0;
//     this.maxValue = 500;

//     // text
//     this.text = { px: 15, numOfDecimals: 0, padding: 1 };

//     // ticks
//     this.tick = { length: 5, labels: [], num: 11 };

//     // line
//     this.axisThicknessPx = 2;
//     this.axisColor = "#000000";
//   }

//   updateTickLabels() {
//     let tickDelta = (this.maxValue - this.minValue) / (this.tick.num - 1);
//     this.tick.labels = [];
//     for (let i = 0; i < this.tick.num; i++) {
//       let val = this.minValue + tickDelta * i;
//       this.tick.labels.push(val.toFixed(this.text.numOfDecimals));
//     }
//   }

//   calcParams(ctx) {
//     // axis start
//     this.axisStartPx = this.heightPx - this.text.px / 2;
//     // Max text width
//     ctx.font = `${this.text.px}px Monospace`;
//     let maxTextWidth = Math.ceil(
//       Math.max(...Array.from(Array(this.tick.num).keys(), (x) => ctx.measureText(this.tick.labels[x]).width))
//     );
//     // Total width
//     this.widthPx = maxTextWidth + this.text.padding + this.tick.length + this.axisThicknessPx;
//   }

//   drawOutline(ctx) {
//     if (!this.showOutline) return;
//     ctx.beginPath();
//     ctx.fillStyle = "blue";
//     ctx.rectBorderInside(0, 0, this.widthPx, this.heightPx, 1);
//     ctx.fill();
//   }

//   drawVerticalLine(ctx) {
//     ctx.beginPath();
//     ctx.lineWidth = this.axisThicknessPx;
//     ctx.fillStyle = "black";
//     ctx.rect(this.widthPx - this.axisThicknessPx, 0, this.axisThicknessPx, this.heightPx);
//     ctx.fill();
//   }

//   drawTicks(ctx) {
//     let tickDelta = (this.heightPx - this.text.px) / (this.tick.num - 1);
//     for (let i = 0; i < this.tick.num; i++) {
//       ctx.beginPath();
//       ctx.fillStyle = "black";
//       ctx.rect(
//         this.widthPx - this.tick.length - this.axisThicknessPx,
//         Math.round(this.axisStartPx - tickDelta * i - this.axisThicknessPx / 2),
//         this.tick.length,
//         this.axisThicknessPx
//       );
//       ctx.fill();
//     }
//   }

//   drawTickLabels(ctx) {
//     let tickDelta = (this.heightPx - this.text.px) / (this.tick.num - 1);
//     ctx.textAlign = "right";
//     ctx.textBaseline = "middle";
//     for (let i = 0; i < this.tick.num; i++) {
//       let x = this.widthPx - this.tick.length - this.text.padding - this.axisThicknessPx;
//       let y = this.axisStartPx - tickDelta * i + 0.1 * this.text.px;
//       ctx.fillStyle = "black";
//       ctx.font = `${this.text.Px}px Monospace`;
//       ctx.fillText(this.tick.labels[i], x, y);
//     }
//   }

//   draw(ctx) {
//     this.calcParams(ctx);
//     this.updateTickLabels();
//     ctx.translate(this.xPx, this.yPx);
//     this.drawOutline(ctx);
//     this.drawVerticalLine(ctx);
//     this.drawTicks(ctx);
//     this.drawTickLabels(ctx);
//     ctx.resetTransform();
//   }
// }

//------------------------------------------------------------------------------------
//                                TestCanvas
//------------------------------------------------------------------------------------
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
    // console.log(`offset Width: ${canvas.offsetWidth}, offset Height: ${canvas.offsetHeight}`);
    this.totalWidth = Math.floor(canvas.offsetWidth);
    this.totalHeight = Math.floor(canvas.offsetWidth / this.aspectRatio);
    ctx.canvas.width = this.totalWidth;
    ctx.canvas.height = this.totalHeight;
    this.W = this.totalWidth - 2 * this.margin;
    this.H = this.totalHeight - 2 * this.margin;

    // Save current transform and transform
    let storedTransform = ctx.getTransform();
    // ctx.translate(0.5, 0.5);

    // Draw line
    this.drawLine(ctx, t);

    // Draw canvas outline
    this.drawAroundCanvas(ctx, t);

    // // draw axis
    // this.axis.heightPx = this.totalHeight - 2 * this.margin;
    // this.axis.xPx = this.margin;
    // this.axis.yPx = this.margin;
    // this.axis.showOutline = false;
    // this.axis.draw(ctx);

    // draw axis
    // this.axis.config.pos.availableHeight = this.totalHeight - 2 * this.margin;
    // this.axis.config.pos.x = this.margin;
    // this.axis.config.pos.y = this.margin;
    // this.axis.config.options.showOutline = true;

    // this.axis.updateConfig({
    //   pos: { availableHeight: this.totalHeight - 2 * this.margin, x: this.margin, y: this.margin },
    //   options: { showOutline: true },
    // });

    this.axis.updateConfig({
      pos: { availableHeight: this.totalHeight - 2 * this.margin, x: this.margin, y: this.margin },
      options: { showOutline: true },
    });

    this.axis.draw(ctx);

    // reset transform to stored
    ctx.setTransform(storedTransform);
  }
}

export { TestCanvas as default };
