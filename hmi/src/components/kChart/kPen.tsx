import "./CanvasRenderingContext2D.extensions";
import { kAxis } from "./kAxis";
import { kData } from "./kData";

export class kPen {
  show: boolean = true;
  label: string = "myPen";
  color: string = "black";
  data: kData | undefined;
  xAxis: kAxis | undefined;
  yAxis: kAxis | undefined;

  constructor(private ctx: CanvasRenderingContext2D, data?: kData, xAxis?: kAxis, yAxis?: kAxis) {
    this.data = data;
    this.xAxis = xAxis;
    this.yAxis = yAxis;
  }

  private drawLine() {
    if (!this.data || !this.xAxis || !this.yAxis) return;
    let xScale = this.xAxis.scaleValue;
    let yScale = this.yAxis.scaleValue;
    this.data.dataset.forEach((point, index) => {
      let x = xScale(point.x);
      let y = yScale(point.y);
      if (index === 0) {
        this.ctx.moveTo(x, y);
        this.ctx.beginPath();
      }
      this.ctx.lineTo(x, y);
    });
    this.ctx.lineWidth = 3; // todo: add thickness
    this.ctx.stroke();
  }

  draw() {
    if (!this.show) return;
    this.ctx.save();
    // this.drawLine();
    this.ctx.restore();
  }
}
