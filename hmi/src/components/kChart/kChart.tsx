import kAxis from "./kAxis";
import kGraph from "./kGraph";
import "./CanvasRenderingContext2D.extensions";

//------------------------------------------------------------------------------------
//                                kChart
//------------------------------------------------------------------------------------
interface kChart {
  aspectRatio: number;
  width: number;
  height: number;
  axis: kAxis;
  graph: kGraph;
}

//------------------------------------------------------------------------------------
//                                kChart
//------------------------------------------------------------------------------------
class kChart {
  constructor() {
    // config
    this.aspectRatio = 1.5;

    // Calculated
    this.width = 1000;
    this.height = 1000;

    // private
    this.axis = new kAxis();
    this.graph = new kGraph();
  }

  updateParams(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    this.width = Math.floor(canvas.offsetWidth);
    this.height = Math.floor(canvas.offsetWidth / this.aspectRatio);
    if (!ctx) return;
    ctx.canvas.width = this.width;
    ctx.canvas.height = this.height;
  }

  drawOutline(ctx: CanvasRenderingContext2D) {
    // if (!this.#config.options.showOutline) return;
    ctx.beginPath();
    ctx.fillStyle = "black";
    ctx.rectBorderInside(0, 0, this.width, this.height, 1);
    ctx.fill();
  }

  draw(canvas: HTMLCanvasElement, t: number) {
    // Update params
    const ctx = canvas.getContext("2d");
    this.updateParams(canvas);
    if (!ctx) return;
    let storedTransform = ctx.getTransform();
    this.drawOutline(ctx);

    // draw axis
    let axisConfig = {
      pos: {
        height: this.height,
        x: 0,
        y: 0,
        margin: { top: 10, bottom: 10, left: 10, right: 0 },
      },
      options: { showOutline: true },
    };
    this.axis.updateConfig({ ...this.axis.config, ...axisConfig });
    this.axis.draw(ctx);

    // Draw graph
    let graphConfig = {
      pos: {
        x: this.axis.params.pos.width,
        y: 0,
        width: this.width - this.axis.params.pos.width,
        height: this.height,
        margin: 10,
      },
      options: { showOutline: true },
    };
    this.graph.updateConfig({ ...this.graph.config, ...graphConfig });
    this.graph.draw(ctx, t);

    // reset transform to stored
    ctx.setTransform(storedTransform);
  }
}

export { kChart as default };
