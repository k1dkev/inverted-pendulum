import { kAxis, kAxisOptions } from "./kAxis";
import { kGraph } from "./kGraph";
import { kPen, kPenOptions } from "./kPen";
import "./CanvasRenderingContext2D.extensions";
import { kLayout, DeepPartial, ExcludeMethods, randColor, kOutline } from "./kChartInterfaces";
import { merge } from "lodash";
import { kData } from "./kData";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
export interface kChartInterface {
  readonly layout: kLayout;
  readonly outline: kOutline;
  readonly aspectRatio: number;
  readonly axes: Array<kAxis>;
  readonly pens: Array<kPen>;
  readonly graph: kGraph | undefined;
  updateOptions(options?: DeepPartial<kChartOptions>): void;
  createAxis(options?: DeepPartial<kAxisOptions>): kAxis;
  deleteAxis(index: number): void;
  createPen(options?: DeepPartial<kPenOptions>): kPen;
  deletePen(index: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

export interface kChartOptions extends Omit<ExcludeMethods<kChartInterface>, "axes" | "graph" | "layout" | "pens"> {
  layout: Omit<kLayout, "width" | "height">;
}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
export class kChart implements kChartInterface {
  #options: kChartOptions;
  #axes: Array<kAxis>;
  #pens: Array<kPen>;
  #graph: kGraph;
  #width: number;
  #height: number;

  constructor(options?: DeepPartial<kChartOptions>) {
    this.#options = {
      layout: {
        x: 0,
        y: 0,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      },
      outline: { show: false, color: randColor(), thickness: 1 },
      aspectRatio: 1.5,
    };
    this.#axes = [];
    this.#pens = [];
    this.#graph = new kGraph();
    this.#width = 0;
    this.#height = 0;
    this.updateOptions(options);
  }

  updateOptions(options?: DeepPartial<kChartOptions>) {
    this.#options = merge(this.#options, options);
  }

  get layout() {
    return merge(this.#options.layout, { width: this.#width, height: this.#height });
  }

  get outline() {
    return this.#options.outline;
  }

  get aspectRatio() {
    return this.#options.aspectRatio;
  }

  get axes() {
    return this.#axes;
  }

  get pens() {
    return this.#pens;
  }

  get graph() {
    return this.#graph;
  }

  private updateLayout(ctx: CanvasRenderingContext2D) {
    this.#width = ctx ? Math.floor(ctx.canvas.offsetWidth) : 0;
    this.#height = ctx ? Math.floor(ctx.canvas.offsetWidth / this.aspectRatio) : 0;
    ctx.canvas.width = this.layout.width;
    ctx.canvas.height = this.layout.height;
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

  private drawAxes(ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < this.#axes.length; i++) {
      let prevAxis = this.#axes[i - 1];
      this.#axes[i].updateOptions({
        layout: {
          x: this.layout.x + (prevAxis ? prevAxis.layout.x + prevAxis.layout.width : 0),
          y: this.layout.y,
          height: this.layout.height,
        },
      });
      this.#axes[i].draw(ctx);
    }
  }

  private drawPens(ctx: CanvasRenderingContext2D) {
    this.#pens.forEach((pen) => {
      pen.draw(ctx);
    });
  }

  private drawGraph(ctx: CanvasRenderingContext2D) {
    let lastAxis = this.#axes[this.#axes.length - 1];
    this.graph.updateOptions({
      layout: {
        x: lastAxis ? lastAxis.layout.x + lastAxis.layout.width : 0,
        y: this.layout.y,
        width: this.layout.width - (lastAxis ? lastAxis.layout.x + lastAxis.layout.width : 0),
        height: this.layout.height,
      },
    });
    this.graph.draw(ctx);
  }

  createAxis(options?: DeepPartial<kAxisOptions>) {
    const axis = new kAxis(options);
    this.#axes.push(axis);
    return axis;
  }

  deleteAxis(index: number) {
    if (!this.#axes[index]) throw new Error("Index does not exist!");
    this.#axes.splice(index, 1);
  }

  createPen(options?: DeepPartial<kPenOptions>, data?: kData, xAxis?: kAxis, yAxis?: kAxis) {
    const pen = new kPen(options, data, xAxis, yAxis);
    this.#pens.push(pen);
    return pen;
  }

  deletePen(index: number) {
    if (!this.#pens[index]) throw new Error("Index does not exist!");
    this.#pens.splice(index, 1);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    this.updateLayout(ctx);
    this.drawPens(ctx);
    this.drawAxes(ctx);
    this.drawGraph(ctx);
    this.drawOutline(ctx);
    ctx.restore();
  }
}
