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
  tickColor: string = "#000000";
  tickLength: number = 5;
  tickCount: number = 5;
  tickPxRange: [number, number] = [0, 100];
  tickEngRange: [number, number] = [0, 1000];
  lineColor: string = "#000000";
  lineThickness: number = 1;

  constructor(private ctx: CanvasRenderingContext2D) {}

  set width(width: number) {
    this.#width = width;
  }

  get width() {
    if (this.axisType === axisType.x) return this.#width;
    this.ctx.font = `${this.textHeight}px ${this.textFont}`;
    return Math.ceil(
      this.maxTextWidth + this.textPadding + this.tickLength + this.lineThickness + this.marginLeft + this.marginRight
    );
  }

  set height(height: number) {
    this.#height = height;
  }

  get height() {
    if (this.axisType === axisType.y) return this.#height;
    return Math.ceil(
      this.textHeight + this.textPadding + this.tickLength + this.lineThickness + this.marginTop + this.marginBottom
    );
  }

  get tickLabels() {
    let engTickDelta = (this.tickEngRange[1] - this.tickEngRange[0]) / (this.tickCount - 1);
    let tickLabels = [];
    for (let i = 0; i < this.tickCount; i++) {
      let val = this.tickEngRange[0] + engTickDelta * i;
      tickLabels.push(val.toFixed(this.textNumOfDecimals));
    }
    return tickLabels;
  }

  private get maxTextWidth() {
    this.ctx.font = `${this.textHeight}px Monospace`;
    let maxTextWidth = this.tickLabels
      .map((label) => this.ctx.measureText(label).width)
      .reduce((prev, curr) => Math.max(prev, curr));
    return maxTextWidth;
  }

  get tickBuffer(): [number, number] {
    if (this.axisType === axisType.y) {
      return [Math.ceil(this.textHeight / 2 + this.marginBottom), Math.ceil(this.textHeight / 2 + this.marginTop)];
    }
    if (this.axisType === axisType.x) {
      return [Math.ceil(this.maxTextWidth / 2 + this.marginLeft), Math.ceil(this.maxTextWidth / 2 + this.marginRight)];
    }
    throw new Error("invalid axisType");
  }

  get tickDelta() {
    return Math.abs(this.tickPxRange[1] - this.tickPxRange[0]) / (this.tickCount - 1);
  }

  private get tickPositions(): Array<number> {
    const isX = this.axisType === axisType.x;
    const isY = this.axisType === axisType.y;
    return [...Array(this.tickCount).keys()].map((i) => {
      if (i === 0) return this.tickPxRange[0] - (isY ? Math.ceil(this.lineThickness) : 0);
      if (i === this.tickCount - 1) return this.tickPxRange[1] - (isX ? Math.ceil(this.lineThickness) : 0);
      return this.tickPxRange[0] + (isX ? 1 : -1) * this.tickDelta * i - this.lineThickness / 2;
    });
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
    this.tickPositions.forEach((pos) => {
      this.ctx.beginPath();
      this.ctx.fillStyle = this.lineColor;
      if (this.axisType === axisType.y) {
        this.ctx.rect(
          this.width - this.tickLength - this.lineThickness - this.marginRight,
          Math.round(pos),
          this.tickLength,
          this.lineThickness
        );
      }
      if (this.axisType === axisType.x) {
        this.ctx.rect(Math.round(pos), this.lineThickness + this.marginTop, this.lineThickness, this.tickLength);
      }
      this.ctx.fill();
    });
  }

  private drawTickLabels() {
    const isX = this.axisType === axisType.x;
    const isY = this.axisType === axisType.y;
    this.ctx.fillStyle = "black";
    this.ctx.font = `${this.textHeight}px Monospace`;
    this.ctx.textAlign = isY ? "right" : "center";
    this.ctx.textBaseline = isY ? "middle" : "top";
    this.tickPositions.forEach((pos, i) => {
      this.ctx.fillText(
        this.tickLabels[i],
        isX ? pos : this.width - this.tickLength - this.textPadding - this.lineThickness - this.marginRight,
        isY ? pos + 0.1 * this.textHeight : this.marginTop + this.tickLength + this.textPadding + this.lineThickness
      );
    });
  }

  scaleValue(value: number): number {
    if (this.tickEngRange[0] === this.tickEngRange[1]) {
      throw new Error("Invalid engineering scaling for ticks");
    }

    if (this.tickPxRange[0] === this.tickPxRange[1]) {
      throw new Error("Invalid start and end pixel values for ticks");
    }

    let x1 = this.tickEngRange[0];
    let x2 = this.tickEngRange[1];
    let y1 = this.tickPxRange[0];
    let y2 = this.tickPxRange[1];
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
