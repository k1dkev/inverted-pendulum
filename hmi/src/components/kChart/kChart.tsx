import { axisType, kAxis } from "./kAxis";
import { kGraph } from "./kGraph";
import { kPen } from "./kPen";
import "./CanvasRenderingContext2D.extensions";
import { randColor } from "./kChartInterfaces";
import { kData } from "./kData";
import { kDrawCoordinator } from "./kDrawCoordinator";

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
  drawCoordinator: kDrawCoordinator;

  constructor(private ctx: CanvasRenderingContext2D) {
    this.graph = new kGraph(ctx);
    this.drawCoordinator = new kDrawCoordinator();
  }

  get width() {
    return this.ctx ? Math.floor(this.ctx.canvas.offsetWidth) : 0;
  }

  get height() {
    return this.ctx ? Math.floor(this.ctx.canvas.offsetWidth / this.aspectRatio) : 0;
  }

  private get xAxes() {
    return this.axes.filter((axis) => axis.axisType === axisType.x);
  }

  private get yAxes() {
    return this.axes.filter((axis) => axis.axisType === axisType.y);
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

  private refreshCoordinator() {
    this.drawCoordinator.x = this.x;
    this.drawCoordinator.y = this.y;
    this.drawCoordinator.width = this.width;
    this.drawCoordinator.height = this.height;
    this.drawCoordinator.refresh();
  }

  private placeAxes() {
    this.xAxes.forEach((axis) => {
      const placement = this.drawCoordinator.placeBottom(axis.height);
      axis.x = placement.x;
      axis.y = placement.y;
      axis.width = placement.width;
    });

    this.yAxes.forEach((axis) => {
      const placement = this.drawCoordinator.placeLeft(axis.width);
      axis.x = placement.x;
      axis.y = placement.y;
      axis.height = placement.height;
      console.log(placement);
    });

    // place empty elements to account for the buffer needed by ticks
    this.drawCoordinator.placeBottom(Math.max(...this.yAxes.map((axis) => axis.tickBuffer[0])));
    this.drawCoordinator.placeTop(Math.max(...this.yAxes.map((axis) => axis.tickBuffer[1])));
    this.drawCoordinator.placeRight(Math.max(...this.xAxes.map((axis) => axis.tickBuffer[1])));
  }

  private drawAxes() {
    this.axes.forEach((axis) => {
      axis.draw();
    });
  }

  private drawPens() {
    this.pens.forEach((pen) => {
      pen.draw();
    });
  }

  private placeGraph() {
    this.graph.x = this.drawCoordinator.freeArea.x;
    this.graph.y = this.drawCoordinator.freeArea.y;
    this.graph.width = this.drawCoordinator.freeArea.width;
    this.graph.height = this.drawCoordinator.freeArea.height;
  }

  private placeTickEndPoints() {
    this.xAxes.forEach((axis) => {
      axis.tickPxRange = [this.graph.x, this.graph.x + this.graph.width];
    });
    this.yAxes.forEach((axis) => {
      axis.tickPxRange = [this.graph.y + this.graph.height, this.graph.y];
    });
  }

  private drawGraph() {
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
    this.refreshCoordinator();
    this.drawBorder();
    this.placeAxes();
    this.placeGraph();
    this.placeTickEndPoints();
    this.drawAxes();
    this.drawGraph();
    this.drawPens();
    this.ctx.restore();
  }
}
