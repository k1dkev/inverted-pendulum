import "./CanvasRenderingContext2D.extensions";
import { DeepPartial, ExcludeMethods, kLayout } from "./kChartInterfaces";
import { merge } from "lodash";
import kAxis from "./kAxis";
import kData from "./kData";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
interface kPenInterface {
  readonly ctx: CanvasRenderingContext2D;
  readonly show: boolean;
  readonly label: string;
  readonly color: string;
  readonly data: kData | undefined;
  readonly xAxis: kAxis | undefined;
  readonly yAxis: kAxis | undefined;
  updateOptions(options?: DeepPartial<kPenOptions>): void;
  draw(): void;
}

interface kPenOptions extends Omit<ExcludeMethods<kPenInterface>, "data" | "xAxis" | "yAxis" | "ctx"> {}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
class kPen implements kPenInterface {
  #options: kPenOptions = {
    show: true,
    label: "",
    color: "black",
  };
  data: kData | undefined;
  xAxis: kAxis | undefined;
  yAxis: kAxis | undefined;
  #ctx: CanvasRenderingContext2D;

  constructor(
    ctx: CanvasRenderingContext2D,
    options?: DeepPartial<kPenOptions>,
    data?: kData,
    xAxis?: kAxis,
    yAxis?: kAxis
  ) {
    this.#ctx = ctx;
    this.data = data;
    this.xAxis = xAxis;
    this.yAxis = yAxis;
    this.updateOptions(options);
  }

  get ctx() {
    return this.#ctx;
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

  updateOptions(options?: DeepPartial<kPenOptions>) {
    this.#options = merge(this.#options, options);
  }

  draw() {
    if (!this.show) return;

    if (!this.data || !this.xAxis || !this.yAxis) {
      throw "Drawing pen failed. Data and x and y axis must be defined.";
    }

    let xScale = this.xAxis.scaleValue;
    let yScale = this.yAxis.scaleValue;

    this.ctx.save();

    // draw line
    this.data.dataset.forEach((point, index) => {
      let x = xScale(point.x);
      let y = yScale(point.y);
      if (index == 0) {
        this.ctx.moveTo(x, y);
        this.ctx.beginPath();
      }
      this.ctx.lineTo(x, y);
    });
    this.ctx.lineWidth = 3; // todo: add thickess
    this.ctx.stroke();

    this.ctx.restore();
  }
}

export { kPen as default };
