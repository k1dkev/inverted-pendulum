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
    if (!this.axis)
      this.axis = new kAxis(ctx, {
        showOutline: true,
        x: 0,
        y: 0,
        margin: { top: 10, bottom: 10, left: 10, right: 0 },
      });
    this.axis.setConfig({ height: this.height });
    this.axis.draw();

    // draw graph
    if (!this.graph)
      this.graph = new kGraph(ctx, {
        x: this.axis.width,
        y: 0,
        width: this.width - this.axis.width,
        height: this.height,
        showOutline: true,
      });
    this.graph.setConfig({ x: this.axis.width, width: this.width - this.axis.width, height: this.height });
    this.graph.draw(t);

    // reset transform to stored
    ctx.setTransform(storedTransform);
  }
}

export { kChart as default };
