//------------------------------------------------------------------------------------
//                                kAxisConfig
//------------------------------------------------------------------------------------
interface kAxisConfig {
  pos: {
    height: number;
    x: number;
    y: number;
    margin: { top: number; bottom: number; left: number; right: number };
  };
  options: {
    showOutline: boolean;
  };
  text: {
    color: string;
    height: number;
    numOfDecimals: number;
    padding: number;
  };
  ticks: {
    color: string;
    length: number;
    count: number;
    minEngValue: number;
    maxEngValue: number;
  };
  line: {
    color: string;
    thickness: number;
  };
}

//------------------------------------------------------------------------------------
//                                kAxisParams
//------------------------------------------------------------------------------------
interface kAxisParams {
  pos: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  ticks: {
    pos: {
      start: number;
      end: number;
      delta: number;
    };
    labels: string[];
  };
}

//------------------------------------------------------------------------------------
//                                kAxis
//------------------------------------------------------------------------------------
class kAxis {
  #params: kAxisParams;
  #config: kAxisConfig;
  constructor() {
    this.#config = {
      pos: {
        height: 100,
        x: 0,
        y: 0,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
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

    // this.updateConfig(config);

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

  updateConfig(config: kAxisConfig) {
    this.#config = { ...this.#config, ...config };
  }

  get config() {
    return { ...this.#config };
  }

  get params() {
    return { ...this.#params };
  }

  updateParams(ctx: CanvasRenderingContext2D) {
    // Tick Labels
    let engTickDelta =
      (this.#config.ticks.maxEngValue - this.#config.ticks.minEngValue) / (this.#config.ticks.count - 1);
    this.#params.ticks.labels = [];
    for (let i = 0; i < this.#config.ticks.count; i++) {
      let val = this.#config.ticks.minEngValue + engTickDelta * i;
      this.#params.ticks.labels.push(val.toFixed(this.#config.text.numOfDecimals));
    }

    // axis start / end
    this.#params.ticks.pos.start =
      this.#config.pos.height - this.#config.text.height / 2 - this.#config.pos.margin.bottom;
    this.#params.ticks.pos.end = this.#config.text.height / 2 + this.#config.pos.margin.top;
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
      maxTextWidth +
      this.#config.text.padding +
      this.#config.ticks.length +
      this.#config.line.thickness +
      this.#config.pos.margin.left +
      this.#config.pos.margin.right;
    this.#params.pos.height = this.#config.pos.height;
    this.#params.pos.x = this.#config.pos.x;
    this.#params.pos.y = this.#config.pos.y;
  }

  drawOutline(ctx: CanvasRenderingContext2D) {
    if (!this.#config.options.showOutline) return;
    ctx.beginPath();
    ctx.fillStyle = "red";
    ctx.rectBorderInside(0, 0, this.#params.pos.width, this.#params.pos.height, 1);
    ctx.fill();
  }

  drawVerticalLine(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.lineWidth = this.#config.line.thickness;
    ctx.fillStyle = "black";
    ctx.rect(
      this.#params.pos.width - this.#config.line.thickness - this.#config.pos.margin.right,
      this.#config.pos.margin.top,
      this.#config.line.thickness,
      this.#params.pos.height - this.#config.pos.margin.top - this.#config.pos.margin.bottom
    );
    ctx.fill();
  }

  drawTicks(ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < this.#config.ticks.count; i++) {
      ctx.beginPath();
      ctx.fillStyle = "black";
      ctx.rect(
        this.#params.pos.width -
          this.#config.ticks.length -
          this.#config.line.thickness -
          this.#config.pos.margin.right,
        Math.round(this.#params.ticks.pos.start - this.#params.ticks.pos.delta * i - this.#config.line.thickness / 2),
        this.#config.ticks.length,
        this.#config.line.thickness
      );
      ctx.fill();
    }
  }

  drawTickLabels(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "black";
    ctx.font = `${this.#config.text.height}px Monospace`;
    for (let i = 0; i < this.#config.ticks.count; i++) {
      ctx.fillText(
        this.#params.ticks.labels[i],
        this.#params.pos.width -
          this.#config.ticks.length -
          this.#config.text.padding -
          this.#config.line.thickness -
          this.#config.pos.margin.right,
        this.#params.ticks.pos.start - this.#params.ticks.pos.delta * i + 0.1 * this.#config.text.height
      );
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.updateParams(ctx);
    let storedTransform = ctx.getTransform();
    ctx.translate(this.#params.pos.x, this.#params.pos.y);
    this.drawOutline(ctx);
    this.drawVerticalLine(ctx);
    this.drawTicks(ctx);
    this.drawTickLabels(ctx);
    ctx.setTransform(storedTransform);
  }
}

export { kAxis as default };
