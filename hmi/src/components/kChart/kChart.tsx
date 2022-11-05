import { axisType, kAxis } from "./kAxis";
import { kGraph } from "./kGraph";
import { kPen } from "./kPen";
import "./CanvasRenderingContext2D.extensions";
import { randColor } from "./kChartInterfaces";
import { kData } from "./kData";

export class kChart {
  x: number = 0;
  y: number = 0;

  marginTop: number = 0;
  marginBottom: number = 0;
  marginLeft: number = 0;
  marginRight: number = 0;

  borderShow: boolean = false;
  borderColor: string = randColor();
  borderThickness: number = 1;

  aspectRatio: number = 1.5;
  axes: Array<kAxis> = [];
  pens: Array<kPen> = [];
  graph: kGraph;

  constructor(private ctx: CanvasRenderingContext2D) {
    this.graph = new kGraph(ctx);
  }

  get width() {
    return this.ctx ? Math.floor(this.ctx.canvas.offsetWidth) : 0;
  }

  get height() {
    return this.ctx ? Math.floor(this.ctx.canvas.offsetWidth / this.aspectRatio) : 0;
  }

  private translateAndClear() {
    this.ctx.translate(this.x, this.y);
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.width, this.height);
    this.ctx.clip();
  }

  private drawBorder() {
    if (!this.borderShow) return;
    this.ctx.fillStyle = this.borderColor;
    this.ctx.rectBorderInside(0, 0, this.width, this.height, this.borderThickness);
  }

  private drawAxes() {
    for (let i = 0; i < this.axes.length; i++) {
      let prevAxis = this.axes[i - 1];
      this.axes[i].x = this.x + (prevAxis ? prevAxis.x + prevAxis.width : 0);
      if (this.axes[i].axisType === axisType.y) {
        this.axes[i].y = this.y;
        this.axes[i].height = this.height;
      }
      if (this.axes[i].axisType === axisType.x) {
        this.axes[i].y = this.y + this.height - this.axes[i].height;
        this.axes[i].width = this.width;
      }
      this.axes[i].draw();
    }
  }

  private drawPens() {
    this.pens.forEach((pen) => {
      pen.draw();
    });
  }

  private drawGraph() {
    let lastAxis = this.axes[this.axes.length - 1];
    this.graph.x = lastAxis ? lastAxis.x + lastAxis.width : 0;
    this.graph.y = this.y;
    this.graph.width = this.width - (lastAxis ? lastAxis.x + lastAxis.width : 0);
    this.graph.height = this.height;
    this.graph.draw();
  }

  createAxis() {
    const axis = new kAxis(this.ctx);
    this.axes.push(axis);
    return axis;
  }

  deleteAxis(index: number) {
    if (!this.axes[index]) throw new Error("Index does not exist!");
    this.axes.splice(index, 1);
  }

  createPen(data?: kData, xAxis?: kAxis, yAxis?: kAxis) {
    const pen = new kPen(this.ctx, data, xAxis, yAxis);
    this.pens.push(pen);
    return pen;
  }

  deletePen(index: number) {
    if (!this.pens[index]) throw new Error("Index does not exist!");
    this.pens.splice(index, 1);
  }

  draw() {
    this.ctx.save();
    this.ctx.canvas.width = this.width;
    this.ctx.canvas.height = this.height;
    this.translateAndClear();
    this.drawPens();
    this.drawAxes();
    this.drawGraph();
    this.drawBorder();
    this.ctx.restore();
  }
}
