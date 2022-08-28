import "./CanvasRenderingContext2D.extensions";
import { DeepPartial } from "./kChartInterfaces";
import { merge, truncate } from "lodash";
import kAxis from "./kAxis";
import kData from "./kData";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
interface kPenInterface {
  readonly show: boolean;
  readonly label: string;
  readonly color: string;
  readonly data?: kData;
  readonly axis?: kAxis;
  updateOptions(options?: DeepPartial<kPenOptions>): void;
}

interface kPenOptions extends Omit<kPenInterface, "updateOptions"> {}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
class kPen implements kPenInterface {
  #options: kPenOptions = {
    show: true,
    label: "",
    color: "black",
    data: undefined,
    axis: undefined,
  };

  constructor(options?: DeepPartial<kPenOptions>) {
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

  get data() {
    return this.#options.data;
  }

  get axis() {
    return this.#options.axis;
  }
}

export { kPen as default };
