import { kLayout, DeepPartial } from "./kChartInterfaces";
import { merge } from "lodash";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
interface kAxisTicks {
  readonly color: string;
  readonly length: number;
  readonly count: number;
  readonly minEngValue: number;
  readonly maxEngValue: number;
  readonly start: number;
  readonly end: number;
  readonly delta: number;
  readonly labels: string[];
}

interface kAxisText {
  readonly color: string;
  readonly height: number;
  readonly numOfDecimals: number;
  readonly padding: number;
}

interface kAxisLine {
  readonly color: string;
  readonly thickness: number;
}

interface kAxisInterface {
  readonly ctx: CanvasRenderingContext2D;
  readonly layout: kLayout;
  readonly showOutline: boolean;
  readonly text: kAxisText;
  readonly ticks: kAxisTicks;
  readonly line: kAxisLine;
}

interface kAxisConfig extends Omit<kAxisInterface, "layout" | "ticks" | "ctx"> {
  readonly layout: Omit<kLayout, "width">;
  readonly ticks: Omit<kAxisTicks, "start" | "end" | "delta" | "labels">;
}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
class kAxis implements kAxisInterface {
  #config: kAxisConfig = {
    layout: {
      x: 0,
      y: 0,
      height: 100,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    },
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

  constructor(ctx: CanvasRenderingContext2D, config?: DeepPartial<kAxisConfig>) {
    this.#ctx = ctx;
    if (config) this.setConfig(config);
  }

  setConfig(config: DeepPartial<kAxisConfig>) {
    this.#config = merge(this.#config, config);
  }

  get ctx() {
    return this.#ctx;
  }

  get layout() {
    this.ctx.font = `${this.#config.text.height}px Monospace`;
    let maxTextWidth = Math.ceil(
      Math.max(
        ...Array.from(Array(this.#config.ticks.count).keys(), (i) => this.ctx.measureText(this.ticks.labels[i]).width)
      )
    );
    let width =
      maxTextWidth +
      this.#config.text.padding +
      this.#config.ticks.length +
      this.#config.line.thickness +
      this.#config.layout.margin.left +
      this.#config.layout.margin.right;
    return merge(this.#config.layout, { width: width });
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
    let ticksStart = this.#config.layout.height - this.#config.text.height / 2 - this.#config.layout.margin.bottom;
    let ticksEnd = this.#config.text.height / 2 + this.#config.layout.margin.top;
    let ticksDelta = Math.abs(ticksEnd - ticksStart) / (this.#config.ticks.count - 1);
    // return
    return {
      ...this.#config.ticks,
      ...{
        labels: ticksLabels,
        start: ticksStart,
        end: ticksEnd,
        delta: ticksDelta,
      },
    };
  }

  get line() {
    return this.#config.line;
  }

  private drawOutline() {
    if (!this.showOutline) return;
    this.ctx.beginPath();
    this.ctx.fillStyle = "red";
    this.ctx.rectBorderInside(0, 0, this.layout.width, this.layout.height, 1);
    this.ctx.fill();
  }

  private drawVerticalLine() {
    this.ctx.beginPath();
    this.ctx.lineWidth = this.line.thickness;
    this.ctx.fillStyle = this.line.color;
    this.ctx.rect(
      this.layout.width - this.line.thickness - this.layout.margin.right,
      this.layout.margin.top,
      this.line.thickness,
      this.layout.height - this.layout.margin.top - this.layout.margin.bottom
    );
    this.ctx.fill();
  }

  private drawTicks() {
    for (let i = 0; i < this.ticks.count; i++) {
      this.ctx.beginPath();
      this.ctx.fillStyle = this.line.color;
      this.ctx.rect(
        this.layout.width - this.ticks.length - this.line.thickness - this.layout.margin.right,
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
        this.layout.width - this.ticks.length - this.text.padding - this.line.thickness - this.layout.margin.right,
        this.ticks.start - this.ticks.delta * i + 0.1 * this.text.height
      );
    }
  }

  draw() {
    // save
    this.ctx.save();

    // Transform and clip
    this.ctx.translate(this.layout.x, this.layout.y);
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.layout.width, this.layout.height);
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
