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
    // place x axes
    const xAxes = this.axes.filter((axis) => axis.axisType === axisType.x);
    xAxes.forEach((axis) => {
      const placement = this.drawCoordinator.placeBottom(axis.height);
      axis.x = placement.x;
      axis.y = placement.y;
      axis.width = placement.width;
    });

    // place y axes
    const yAxes = this.axes.filter((axis) => axis.axisType === axisType.y);
    yAxes.forEach((axis) => {
      const placement = this.drawCoordinator.placeLeft(axis.width);
      axis.x = placement.x;
      axis.y = placement.y;
      axis.height = placement.height;
    });

    // place empty elements to account for the buffer needed by ticks
    this.drawCoordinator.placeBottom(Math.max(...yAxes.map((axis) => axis.tickBuffer.start)));
    this.drawCoordinator.placeTop(Math.max(...yAxes.map((axis) => axis.tickBuffer.end)));
    this.drawCoordinator.placeRight(Math.max(...xAxes.map((axis) => axis.tickBuffer.end)));

    // TODO: figure out math to floor and math ceil
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

  private drawGraph() {
    this.graph.borderShow = true; // TODO DELETE
    this.graph.borderColor = "black"; // TODO DELETE
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
    this.drawAxes();
    this.drawGraph();
    this.drawPens();
    this.ctx.restore();
  }
}
