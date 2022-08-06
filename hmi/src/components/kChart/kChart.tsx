import kAxis from "./kAxis";
import kGraph from "./kGraph";
import "./CanvasRenderingContext2D.extensions";
import { kLayout, DeepPartial } from "./kChartInterfaces";
import { merge } from "lodash";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
interface kChartData {
  readonly ctx: CanvasRenderingContext2D | null;
  readonly layout: kLayout;
  readonly showOutline: boolean;
  readonly aspectRatio: number;
  readonly axis: kAxis | null;
  readonly graph: kGraph | null;
}

interface kChartConfig extends Omit<kChartData, "ctx" | "axis" | "graph" | "layout"> {
  layout: Omit<kLayout, "width" | "height">;
}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
class kChart implements kChartData {
  #config: kChartConfig = {
    layout: {
      x: 0,
      y: 0,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    },
    showOutline: false,
    aspectRatio: 1.5,
  };
  #ctx: CanvasRenderingContext2D | null;
  #axis: kAxis | null;
  #graph: kGraph | null;

  constructor(config?: DeepPartial<kChartConfig>) {
    this.#ctx = null;
    this.#axis = null;
    this.#graph = null;
    if (config) this.setConfig(config);
  }

  setConfig(config: DeepPartial<kChartConfig>) {
    this.#config = merge(this.#config, config);
  }

  get ctx() {
    return this.#ctx;
  }

  get layout() {
    let width = this.ctx ? Math.floor(this.ctx.canvas.offsetWidth) : 0;
    let height = this.ctx ? Math.floor(this.ctx.canvas.offsetWidth / this.aspectRatio) : 0;
    return merge(this.#config.layout, { width: width, height: height });
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
    this.ctx.rectBorderInside(0, 0, this.layout.width, this.layout.height, 1);
    this.ctx.fill();
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    // set ctx
    this.#ctx = ctx;
    if (!this.ctx) return;

    // set canvas width and height
    this.ctx.canvas.width = this.layout.width;
    this.ctx.canvas.height = this.layout.height;

    // save
    this.ctx.save();

    // draw outline
    this.drawOutline();

    // draw axis
    if (!this.#axis) {
      this.#axis = new kAxis(this.ctx, {
        showOutline: false,
        layout: {
          x: 0,
          y: 0,
          margin: { top: 10, bottom: 10, left: 10, right: 0 },
        },
      });
    }
    if (!this.axis) return;
    this.axis.setConfig({ layout: { height: this.layout.height } });
    this.axis.draw();

    // draw graph
    if (!this.#graph) {
      this.#graph = new kGraph(this.ctx, {
        layout: {
          x: this.axis.layout.width,
          y: 0,
          width: this.layout.width - this.axis.layout.width,
          height: this.layout.height,
        },
        showOutline: false,
      });
    }
    if (!this.graph) return;
    this.graph.setConfig({
      layout: {
        x: this.axis.layout.width,
        width: this.layout.width - this.axis.layout.width,
        height: this.layout.height,
      },
    });
    this.graph.draw(t);

    // reset transform to stored
    this.ctx.restore();
  }
}

export { kChart as default };
