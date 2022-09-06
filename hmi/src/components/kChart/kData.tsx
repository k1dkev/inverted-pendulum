import "./CanvasRenderingContext2D.extensions";
import { DeepPartial, ExcludeMethods, kDataPoint } from "./kChartInterfaces";
import { merge } from "lodash";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
export interface kDataInterface {
  readonly label: string;
  readonly dataset: Array<kDataPoint>;
  readonly maxNumOfPoints: number;
  updateOptions(options: DeepPartial<kDataOptions>): void;
  addDataPoint(point: kDataPoint): void;
  clearData(): void;
}

export interface kDataOptions extends Omit<ExcludeMethods<kDataInterface>, "dataset"> {}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
export class kData implements kDataInterface {
  #options: kDataOptions = {
    label: "default label",
    maxNumOfPoints: 100,
  };
  #dataset: Array<kDataPoint>;

  constructor(options?: DeepPartial<kDataOptions>) {
    this.#dataset = [];
    this.updateOptions(options);
  }

  get dataset() {
    return this.#dataset;
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
    this.#dataset.push(point);
    while (this.#dataset.length > this.maxNumOfPoints) {
      this.#dataset.pop();
    }
  }

  clearData() {
    this.#dataset = [];
  }
}
