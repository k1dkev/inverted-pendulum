import kAxis from "./kAxis";
import kGraph from "./kGraph";
import "./CanvasRenderingContext2D.extensions";
import { kBase } from "./kChartInterfaces";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
interface kChartData extends Omit<kBase, "ctx"> {
  readonly ctx: CanvasRenderingContext2D | null;
  readonly aspectRatio: number;
  readonly axis: kAxis | null;
  readonly graph: kGraph | null;
}

interface kChartConfig extends Omit<kChartData, "ctx" | "axis" | "graph" | "canvas" | "width" | "height"> {}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
class kChart implements kChartData {
  #config: kChartConfig = {
    x: 0,
    y: 0,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    showOutline: false,
    aspectRatio: 1.5,
  };
  #ctx: CanvasRenderingContext2D | null;
  #axis: kAxis | null;
  #graph: kGraph | null;

  constructor(config?: Partial<kChartConfig>) {
    this.#ctx = null;
    this.#axis = null;
    this.#graph = null;
    if (config) this.setConfig(config);
  }

  setConfig(config: Partial<kChartConfig>) {
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
    if (!this.ctx) return 0;
    let width = Math.floor(this.ctx.canvas.offsetWidth);
    return width;
  }

  get height() {
    if (!this.ctx) return 0;
    let height = Math.floor(this.ctx.canvas.offsetWidth / this.aspectRatio);
    return height;
  }

  get margin() {
    return this.#config.margin;
  }

  get showOutline() {
    return this.#config.showOutline;
  }

  get aspectRatio() {
    return this.#config.aspectRatio;
  }

  get axis() {
    return this.#axis;
  }

  get graph() {
    return this.#graph;
  }

  private drawOutline() {
    if (!this.showOutline || !this.ctx) return;
    this.ctx.beginPath();
    this.ctx.fillStyle = "black";
    this.ctx.rectBorderInside(0, 0, this.width, this.height, 1);
    this.ctx.fill();
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    // set ctx
    this.#ctx = ctx;
    if (!this.ctx) return;

    // set canvas width and height
    this.ctx.canvas.width = this.width;
    this.ctx.canvas.height = this.height;

    // store transform
    let storedTransform = this.ctx.getTransform();

    // draw outline
    this.drawOutline();

    // draw axis
    if (!this.#axis) {
      this.#axis = new kAxis(this.ctx, {
        showOutline: true,
        x: 0,
        y: 0,
        margin: { top: 10, bottom: 10, left: 10, right: 0 },
      });
    }
    if (!this.axis) return;
    this.axis.setConfig({ height: this.height });
    this.axis.draw();

    // draw graph
    if (!this.#graph) {
      this.#graph = new kGraph(this.ctx, {
        x: this.axis.width,
        y: 0,
        width: this.width - this.axis.width,
        height: this.height,
        showOutline: true,
      });
    }
    if (!this.graph) return;
    this.graph.setConfig({ x: this.axis.width, width: this.width - this.axis.width, height: this.height });
    this.graph.draw(t);

    // reset transform to stored
    this.ctx.setTransform(storedTransform);
  }
}

export { kChart as default };
