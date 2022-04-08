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

export { kAxis as default };
