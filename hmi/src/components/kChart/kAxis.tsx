import { randColor } from "./kChartInterfaces";

export enum axisType {
  x = "x",
  y = "y",
}

export class kAxis {
  x: number = 0;
  y: number = 0;
  #width: number = 100;
  #height: number = 100;
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
  ticksMinEngValue: number = 7777;
  ticksMaxEngValue: number = 500;
  lineColor: string = "#000000";
  lineThickness: number = 1;

  constructor(private ctx: CanvasRenderingContext2D) {}

  set width(width: number) {
    this.#width = width;
  }

  get width() {
    if (this.axisType === axisType.x) return this.#width;
    this.ctx.font = `${this.textHeight}px ${this.textFont}`;
    return (
      this.maxTextWidth + this.textPadding + this.ticksLength + this.lineThickness + this.marginLeft + this.marginRight
    );
  }

  set height(height: number) {
    this.#height = height;
  }

  get height() {
    if (this.axisType === axisType.y) return this.#height;
    return (
      this.textHeight + this.textPadding + this.ticksLength + this.lineThickness + this.marginTop + this.marginBottom
    );
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

  private get maxTextWidth() {
    this.ctx.font = `${this.textHeight}px Monospace`;
    let maxTextWidth = this.ticksLabels
      .map((label) => this.ctx.measureText(label).width)
      .reduce((prev, curr) => Math.max(prev, curr));
    return maxTextWidth;
  }

  get tickBuffer() {
    if (this.axisType === axisType.y) {
      return {
        start: Math.ceil(this.textHeight / 2 + this.marginBottom),
        end: Math.ceil(this.textHeight / 2 + this.marginTop),
      };
    }
    if (this.axisType === axisType.x) {
      return {
        start: Math.ceil(this.maxTextWidth / 2 + this.marginLeft),
        end: Math.ceil(this.maxTextWidth / 2 + this.marginRight),
      };
    }
    throw new Error("invalid axisType");
  }

  get ticksStart() {
    if (this.axisType === axisType.y) return this.height - this.textHeight / 2 - this.marginBottom;
    if (this.axisType === axisType.x) return this.maxTextWidth / 2 + this.marginLeft;
    throw new Error("invalid axisType");
  }

  get ticksEnd() {
    if (this.axisType === axisType.y) return this.textHeight / 2 + this.marginTop;
    if (this.axisType === axisType.x) return this.width - this.maxTextWidth / 2 - this.marginRight;
    throw new Error("invalid axisType");
  }

  get ticksDelta() {
    return Math.abs(this.ticksEnd - this.ticksStart) / (this.ticksCount - 1);
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

  private drawAxisLine() {
    this.ctx.beginPath();
    this.ctx.lineWidth = this.lineThickness;
    this.ctx.fillStyle = this.lineColor;
    if (this.axisType === axisType.y) {
      this.ctx.rect(
        this.width - this.lineThickness - this.marginRight,
        this.marginTop,
        this.lineThickness,
        this.height - this.marginTop - this.marginBottom
      );
    }
    if (this.axisType === axisType.x) {
      this.ctx.rect(
        this.marginRight,
        this.marginTop,
        this.width - this.marginLeft - this.marginRight,
        this.lineThickness
      );
    }
    this.ctx.fill();
  }

  private drawTicks() {
    for (let i = 0; i < this.ticksCount; i++) {
      this.ctx.beginPath();
      this.ctx.fillStyle = this.lineColor;
      if (this.axisType === axisType.y) {
        this.ctx.rect(
          this.width - this.ticksLength - this.lineThickness - this.marginRight,
          Math.round(this.ticksStart - this.ticksDelta * i - this.lineThickness / 2),
          this.ticksLength,
          this.lineThickness
        );
      }
      if (this.axisType === axisType.x) {
        this.ctx.rect(
          Math.round(this.ticksStart + this.ticksDelta * i + this.lineThickness / 2),
          this.lineThickness + this.marginTop,
          this.lineThickness,
          this.ticksLength
        );
      }
      this.ctx.fill();
    }
  }

  private drawTickLabels() {
    this.ctx.fillStyle = "black";
    this.ctx.font = `${this.textHeight}px Monospace`;
    if (this.axisType === axisType.y) {
      this.ctx.textAlign = "right";
      this.ctx.textBaseline = "middle";
      for (let i = 0; i < this.ticksCount; i++) {
        this.ctx.fillText(
          this.ticksLabels[i],
          this.width - this.ticksLength - this.textPadding - this.lineThickness - this.marginRight,
          this.ticksStart - this.ticksDelta * i + 0.1 * this.textHeight
        );
      }
    }
    if (this.axisType === axisType.x) {
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "top";
      for (let i = 0; i < this.ticksCount; i++) {
        this.ctx.fillText(
          this.ticksLabels[i],
          this.ticksStart + this.ticksDelta * i,
          this.marginTop + this.ticksLength + this.textPadding + this.lineThickness
        );
      }
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
    this.drawAxisLine();
    this.drawTicks();
    this.drawTickLabels();
    this.drawBorder();
    this.ctx.restore();
  }
}
