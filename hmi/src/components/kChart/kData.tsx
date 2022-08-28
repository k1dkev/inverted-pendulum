import "./CanvasRenderingContext2D.extensions";
import { DeepPartial, ExcludeMethods, kDataPoint } from "./kChartInterfaces";
import { merge } from "lodash";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
interface kDataInterface {
  readonly label: string;
  readonly data: Array<kDataPoint>;
  readonly maxNumOfPoints: number;
  updateOptions(options: DeepPartial<kDataOptions>): void;
  addDataPoint(point: kDataPoint): void;
  clearData(): void;
}

interface kDataOptions extends Omit<ExcludeMethods<kDataInterface>, "data"> {}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
class kData implements kDataInterface {
  #options: kDataOptions = {
    label: "",
    maxNumOfPoints: 0,
  };
  #data: Array<kDataPoint>;

  constructor(options?: DeepPartial<kDataOptions>) {
    this.#data = [];
    this.updateOptions(options);
  }

  get data() {
    return this.#data;
  }

  get label() {
    return this.#options.label;
  }

  get maxNumOfPoints() {
    return this.#options.maxNumOfPoints;
  }

  updateOptions(options?: DeepPartial<kDataOptions>) {
    this.#options = merge(this.#options, options);
  }

  addDataPoint(point: kDataPoint) {
    this.#data.push(point);
    while (this.#data.length > this.maxNumOfPoints) {
      this.#data.pop();
    }
  }

  clearData() {
    this.#data = [];
  }
}

export { kData as default };
