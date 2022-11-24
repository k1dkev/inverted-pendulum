import { randColor } from "./kChartInterfaces";

export class kGraph {
  x: number = 0;
  y: number = 0;
  width: number = 100;
  height: number = 100;

  marginTop: number = 0;
  marginBottom: number = 0;
  marginLeft: number = 0;
  marginRight: number = 0;

  borderShow: boolean = false;
  borderColor: string = randColor();
  borderThickness: number = 1;

  constructor(private ctx: CanvasRenderingContext2D) {}

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
    // console.log({ x: this.x, y: this.y, width: this.width, height: this.height });
  }

  draw() {
    this.ctx.save();
    this.translateAndClear();
    this.drawBorder();
    this.ctx.restore();
  }
}
