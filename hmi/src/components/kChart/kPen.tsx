import "./CanvasRenderingContext2D.extensions";
import { DeepPartial, ExcludeMethods } from "./kChartInterfaces";
import { merge } from "lodash";
import { kAxis } from "./kAxis";
import { kData } from "./kData";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
export interface kPenInterface {
  readonly show: boolean;
  readonly label: string;
  readonly color: string;
  readonly data: kData | undefined;
  readonly xAxis: kAxis | undefined;
  readonly yAxis: kAxis | undefined;
  updateOptions(options?: DeepPartial<kPenOptions>): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

export interface kPenOptions extends Omit<ExcludeMethods<kPenInterface>, "data" | "xAxis" | "yAxis"> {}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
export class kPen implements kPenInterface {
  #options: kPenOptions;
  data: kData | undefined;
  xAxis: kAxis | undefined;
  yAxis: kAxis | undefined;

  constructor(options?: DeepPartial<kPenOptions>, data?: kData, xAxis?: kAxis, yAxis?: kAxis) {
    this.#options = {
      show: true,
      label: "",
      color: "black",
    };
    this.data = data;
    this.xAxis = xAxis;
    this.yAxis = yAxis;
    this.updateOptions(options);
  }

  updateOptions(options?: DeepPartial<kPenOptions>) {
    this.#options = merge(this.#options, options);
  }

  get show() {
    return this.#options.show;
  }

  get label() {
    return this.#options.label;
  }

  get color() {
    return this.#options.color;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.show) return;

    if (!this.data || !this.xAxis || !this.yAxis) {
      throw "Drawing pen failed. Data and x and y axis must be defined.";
    }

    let xScale = this.xAxis.scaleValue;
    let yScale = this.yAxis.scaleValue;

    ctx.save();

    // draw line
    this.data.dataset.forEach((point, index) => {
      let x = xScale(point.x);
      let y = yScale(point.y);
      if (index == 0) {
        ctx.moveTo(x, y);
        ctx.beginPath();
      }
      ctx.lineTo(x, y);
    });
    ctx.lineWidth = 3; // todo: add thickess
    ctx.stroke();

    ctx.restore();
  }
}

export default {};
