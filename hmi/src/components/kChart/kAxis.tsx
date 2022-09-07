import { kLayout, DeepPartial, ExcludeMethods, randColor, kOutline } from "./kChartInterfaces";
import { merge } from "lodash";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
export interface kAxisTicks {
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

export interface kAxisText {
  readonly color: string;
  readonly height: number;
  readonly numOfDecimals: number;
  readonly padding: number;
}

export interface kAxisLine {
  readonly color: string;
  readonly thickness: number;
}

export enum axisType {
  x = "x",
  y = "y",
}

export interface kAxisInterface {
  readonly layout: kLayout;
  readonly outline: kOutline;
  readonly axisType: axisType;
  readonly text: kAxisText;
  readonly ticks: kAxisTicks;
  readonly line: kAxisLine;
  scaleValue(value: number): number;
  draw(ctx: CanvasRenderingContext2D): void;
}

export interface kAxisOptions extends Omit<ExcludeMethods<kAxisInterface>, "layout" | "ticks"> {
  readonly layout: Omit<kLayout, "width">;
  readonly ticks: Omit<kAxisTicks, "start" | "end" | "delta" | "labels">;
}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
export class kAxis implements kAxisInterface {
  #options: kAxisOptions;
  #width: number;

  constructor(options?: DeepPartial<kAxisOptions>) {
    this.#options = {
      layout: {
        x: 0,
        y: 0,
        height: 100,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      },
      outline: { show: false, color: randColor(), thickness: 1 },
      axisType: axisType.x,
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
    this.#width = 0;
    this.updateOptions(options);
  }

  updateOptions(options?: DeepPartial<kAxisOptions>) {
    this.#options = merge(this.#options, options);
  }

  get layout() {
    return merge(this.#options.layout, { width: this.#width });
  }

  get outline() {
    return this.#options.outline;
  }

  get axisType() {
    return this.#options.axisType;
  }

  get text() {
    return this.#options.text;
  }

  get ticks() {
    // Tick Labels
    let engTickDelta =
      (this.#options.ticks.maxEngValue - this.#options.ticks.minEngValue) / (this.#options.ticks.count - 1);
    let ticksLabels = [];
    for (let i = 0; i < this.#options.ticks.count; i++) {
      let val = this.#options.ticks.minEngValue + engTickDelta * i;
      ticksLabels.push(val.toFixed(this.#options.text.numOfDecimals));
    }
    // axis start / end
    let ticksStart = this.#options.layout.height - this.#options.text.height / 2 - this.#options.layout.margin.bottom;
    let ticksEnd = this.#options.text.height / 2 + this.#options.layout.margin.top;
    let ticksDelta = Math.abs(ticksEnd - ticksStart) / (this.#options.ticks.count - 1);
    // return
    return merge(this.#options.ticks, {
      labels: ticksLabels,
      start: ticksStart,
      end: ticksEnd,
      delta: ticksDelta,
    });
  }

  get line() {
    return this.#options.line;
  }

  private updateLayout(ctx: CanvasRenderingContext2D) {
    ctx.font = `${this.#options.text.height}px Monospace`;
    let maxTextWidth = Math.ceil(
      Math.max(
        ...Array.from(Array(this.#options.ticks.count).keys(), (i) => ctx.measureText(this.ticks.labels[i]).width)
      )
    );
    this.#width =
      maxTextWidth +
      this.#options.text.padding +
      this.#options.ticks.length +
      this.#options.line.thickness +
      this.#options.layout.margin.left +
      this.#options.layout.margin.right;
  }

  private translateAndClear(ctx: CanvasRenderingContext2D) {
    ctx.translate(this.layout.x, this.layout.y);
    ctx.beginPath();
    ctx.rect(0, 0, this.layout.width, this.layout.height);
    ctx.clip();
  }

  private drawOutline(ctx: CanvasRenderingContext2D) {
    if (!this.outline.show) return;
    ctx.fillStyle = this.outline.color;
    ctx.rectBorderInside(0, 0, this.layout.width, this.layout.height, this.outline.thickness);
  }

  private drawVerticalLine(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.lineWidth = this.line.thickness;
    ctx.fillStyle = this.line.color;
    ctx.rect(
      this.layout.width - this.line.thickness - this.layout.margin.right,
      this.layout.margin.top,
      this.line.thickness,
      this.layout.height - this.layout.margin.top - this.layout.margin.bottom
    );
    ctx.fill();
  }

  private drawTicks(ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < this.ticks.count; i++) {
      ctx.beginPath();
      ctx.fillStyle = this.line.color;
      ctx.rect(
        this.layout.width - this.ticks.length - this.line.thickness - this.layout.margin.right,
        Math.round(this.ticks.start - this.ticks.delta * i - this.line.thickness / 2),
        this.ticks.length,
        this.line.thickness
      );
      ctx.fill();
    }
  }

  private drawTickLabels(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "black";
    ctx.font = `${this.text.height}px Monospace`;
    for (let i = 0; i < this.ticks.count; i++) {
      ctx.fillText(
        this.ticks.labels[i],
        this.layout.width - this.ticks.length - this.text.padding - this.line.thickness - this.layout.margin.right,
        this.ticks.start - this.ticks.delta * i + 0.1 * this.text.height
      );
    }
  }

  scaleValue(value: number): number {
    if (this.ticks.minEngValue === this.ticks.maxEngValue) {
      throw new Error("Invalid engineering scaling for ticks");
    }

    if (this.ticks.start === this.ticks.end) {
      throw new Error("Invalid start and end pixel values for ticks");
    }

    let x1 = this.ticks.minEngValue;
    let x2 = this.ticks.maxEngValue;
    let y1 = this.ticks.start;
    let y2 = this.ticks.end;
    return (value - x1) * ((y2 - y1) / (x2 - x1)) + y1;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    this.updateLayout(ctx);
    this.translateAndClear(ctx);
    this.drawVerticalLine(ctx);
    this.drawTicks(ctx);
    this.drawTickLabels(ctx);
    this.drawOutline(ctx);
    ctx.restore();
  }
}
