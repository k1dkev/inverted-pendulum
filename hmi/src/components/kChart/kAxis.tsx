import { randColor } from "./kChartInterfaces";

export enum axisType {
  x = "x",
  y = "y",
}

export class kAxis {
  x: number = 0;
  y: number = 0;
  height: number = 100;
  marginTop: number = 0;
  marginBottom: number = 0;
  marginLeft: number = 0;
  marginRight: number = 0;
  borderShow: boolean = true;
  borderColor: string = randColor();
  borderThickness: number = 1;
  axisType: axisType = axisType.x;
  textColor: string = "#000000";
  textHeight: number = 15;
  textNumOfDecimals: number = 0;
  textPadding: number = 1;
  textFont: string = "Monospace";
  ticksColor: string = "#000000";
  ticksLength: number = 5;
  ticksCount: number = 11;
  ticksMinEngValue: number = 0;
  ticksMaxEngValue: number = 500;
  lineColor: string = "#000000";
  lineThickness: number = 1;

  constructor(private ctx: CanvasRenderingContext2D) {}

  get width() {
    this.ctx.font = `${this.textHeight}px ${this.textFont}`;
    let maxTextWidth = this.ticksLabels
      .map((label) => this.ctx.measureText(label).width)
      .reduce((prev, curr) => Math.max(prev, curr));
    return maxTextWidth + this.textPadding + this.ticksLength + this.lineThickness + this.marginLeft + this.marginRight;
  }

  get ticksLabels() {
    let engTickDelta = (this.ticksMaxEngValue - this.ticksMinEngValue) / (this.ticksCount - 1);
    let ticksLabels = [];
    for (let i = 0; i < this.ticksCount; i++) {
      let val = this.ticksMinEngValue + engTickDelta * i;
      ticksLabels.push(val.toFixed(this.textNumOfDecimals));
    }
    return ticksLabels;
  }

  get ticksStart() {
    return this.height - this.textHeight / 2 - this.marginBottom;
  }

  get ticksEnd() {
    return this.textHeight / 2 + this.marginTop;
  }

  get ticksDelta() {
    return Math.abs(this.ticksEnd - this.ticksStart) / (this.ticksCount - 1);
  }

  private translateAndClear() {
    if (!this.ctx) return;
    this.ctx.translate(this.x, this.y);
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.width, this.height);
    this.ctx.clip();
  }

  private drawBorder() {
    if (!this.ctx) return;
    if (!this.borderShow) return;
    this.ctx.fillStyle = this.borderColor;
    this.ctx.rectBorderInside(0, 0, this.width, this.height, this.borderThickness);
  }

  private drawVerticalLine() {
    if (!this.ctx) return;
    this.ctx.beginPath();
    this.ctx.lineWidth = this.lineThickness;
    this.ctx.fillStyle = this.lineColor;
    this.ctx.rect(
      this.width - this.lineThickness - this.marginRight,
      this.marginTop,
      this.lineThickness,
      this.height - this.marginTop - this.marginBottom
    );
    this.ctx.fill();
  }

  private drawTicks() {
    if (!this.ctx) return;
    for (let i = 0; i < this.ticksCount; i++) {
      this.ctx.beginPath();
      this.ctx.fillStyle = this.lineColor;
      this.ctx.rect(
        this.width - this.ticksLength - this.lineThickness - this.marginRight,
        Math.round(this.ticksStart - this.ticksDelta * i - this.lineThickness / 2),
        this.ticksLength,
        this.lineThickness
      );
      this.ctx.fill();
    }
  }

  private drawTickLabels() {
    if (!this.ctx) return;
    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "middle";
    this.ctx.fillStyle = "black";
    this.ctx.font = `${this.textHeight}px Monospace`;
    for (let i = 0; i < this.ticksCount; i++) {
      this.ctx.fillText(
        this.ticksLabels[i],
        this.width - this.ticksLength - this.textPadding - this.lineThickness - this.marginRight,
        this.ticksStart - this.ticksDelta * i + 0.1 * this.textHeight
      );
    }
  }

  scaleValue(value: number): number {
    if (this.ticksMinEngValue === this.ticksMaxEngValue) {
      throw new Error("Invalid engineering scaling for ticks");
    }

    if (this.ticksStart === this.ticksEnd) {
      throw new Error("Invalid start and end pixel values for ticks");
    }

    let x1 = this.ticksMinEngValue;
    let x2 = this.ticksMaxEngValue;
    let y1 = this.ticksStart;
    let y2 = this.ticksEnd;
    return (value - x1) * ((y2 - y1) / (x2 - x1)) + y1;
  }

  draw() {
    this.ctx.save();
    this.translateAndClear();
    this.drawVerticalLine();
    this.drawTicks();
    this.drawTickLabels();
    this.drawBorder();
    this.ctx.restore();
  }
}
