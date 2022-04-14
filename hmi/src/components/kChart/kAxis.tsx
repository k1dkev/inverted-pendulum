import { kBase } from "./kChartInterfaces";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
interface kAxisData extends kBase {
  readonly text: {
    readonly color: string;
    readonly height: number;
    readonly numOfDecimals: number;
    readonly padding: number;
  };
  readonly ticks: {
    readonly color: string;
    readonly length: number;
    readonly count: number;
    readonly minEngValue: number;
    readonly maxEngValue: number;
    readonly start: number;
    readonly end: number;
    readonly delta: number;
    readonly labels: string[];
  };
  readonly line: { readonly color: string; readonly thickness: number };
}

interface kAxisConfig extends Omit<kAxisData, "width" | "ticks" | "ctx"> {
  readonly ticks: {
    readonly color: string;
    readonly length: number;
    readonly count: number;
    readonly minEngValue: number;
    readonly maxEngValue: number;
  };
}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
class kAxis implements kAxisData {
  #config: kAxisConfig = {
    x: 0,
    y: 0,
    height: 100,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    showOutline: false,
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
  #ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D, config?: Partial<kAxisConfig>) {
    this.#ctx = ctx;
    if (config) this.setConfig(config);
  }

  setConfig(config: Partial<kAxisConfig>) {
    this.#config = { ...this.#config, ...config };
  }

  get ctx() {
    return this.#ctx;
  }

  get x() {
    return this.#config.x;
  }

  get y() {
    return this.#config.y;
  }

  get width() {
    // Max text width
    this.ctx.font = `${this.#config.text.height}px Monospace`;
    let maxTextWidth = Math.ceil(
      Math.max(
        ...Array.from(Array(this.#config.ticks.count).keys(), (i) => this.ctx.measureText(this.ticks.labels[i]).width)
      )
    );

    return (
      maxTextWidth +
      this.#config.text.padding +
      this.#config.ticks.length +
      this.#config.line.thickness +
      this.#config.margin.left +
      this.#config.margin.right
    );
  }
  get height() {
    return this.#config.height;
  }

  get margin() {
    return this.#config.margin;
  }

  get showOutline() {
    return this.#config.showOutline;
  }

  get text() {
    return this.#config.text;
  }

  get ticks() {
    // Tick Labels
    let engTickDelta =
      (this.#config.ticks.maxEngValue - this.#config.ticks.minEngValue) / (this.#config.ticks.count - 1);
    let ticksLabels = [];
    for (let i = 0; i < this.#config.ticks.count; i++) {
      let val = this.#config.ticks.minEngValue + engTickDelta * i;
      ticksLabels.push(val.toFixed(this.#config.text.numOfDecimals));
    }
    // axis start / end
    let ticksStart = this.#config.height - this.#config.text.height / 2 - this.#config.margin.bottom;
    let ticksEnd = this.#config.text.height / 2 + this.#config.margin.top;
    let ticksDelta = Math.abs(ticksEnd - ticksStart) / (this.#config.ticks.count - 1);
    // return
    return { ...this.#config.ticks, ...{ labels: ticksLabels, start: ticksStart, end: ticksEnd, delta: ticksDelta } };
  }

  get line() {
    return this.#config.line;
  }

  private drawOutline() {
    if (!this.showOutline) return;
    this.ctx.beginPath();
    this.ctx.fillStyle = "red";
    this.ctx.rectBorderInside(0, 0, this.width, this.height, 1);
    this.ctx.fill();
  }

  private drawVerticalLine() {
    this.ctx.beginPath();
    this.ctx.lineWidth = this.line.thickness;
    this.ctx.fillStyle = this.line.color;
    this.ctx.rect(
      this.width - this.line.thickness - this.margin.right,
      this.margin.top,
      this.line.thickness,
      this.height - this.margin.top - this.margin.bottom
    );
    this.ctx.fill();
  }

  private drawTicks() {
    for (let i = 0; i < this.ticks.count; i++) {
      this.ctx.beginPath();
      this.ctx.fillStyle = this.line.color;
      this.ctx.rect(
        this.width - this.ticks.length - this.line.thickness - this.margin.right,
        Math.round(this.ticks.start - this.ticks.delta * i - this.line.thickness / 2),
        this.ticks.length,
        this.line.thickness
      );
      this.ctx.fill();
    }
  }

  private drawTickLabels() {
    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "middle";
    this.ctx.fillStyle = "black";
    this.ctx.font = `${this.text.height}px Monospace`;
    for (let i = 0; i < this.ticks.count; i++) {
      this.ctx.fillText(
        this.ticks.labels[i],
        this.width - this.ticks.length - this.text.padding - this.line.thickness - this.margin.right,
        this.ticks.start - this.ticks.delta * i + 0.1 * this.text.height
      );
    }
  }

  draw() {
    // save
    this.ctx.save();

    // Transform and clip
    this.ctx.translate(this.x, this.y);
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.width, this.height);
    this.ctx.clip();

    // Draw objects
    this.drawOutline();
    this.drawVerticalLine();
    this.drawTicks();
    this.drawTickLabels();

    // restore
    this.ctx.restore();
  }
}

export { kAxis as default };
