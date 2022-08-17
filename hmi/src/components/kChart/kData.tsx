import "./CanvasRenderingContext2D.extensions";
import { DeepPartial } from "./kChartInterfaces";
import { merge } from "lodash";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
interface kDataPoint {
  readonly x: number;
  readonly y: number;
}

interface kDataData {
  readonly label: string;
  readonly data: Array<kDataPoint>;
  readonly maxNumOfPoints: number;
}

interface kDataConfig extends Omit<kDataData, "data"> {}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
class kData implements kDataData {
  #config: kDataConfig = {
    label: "",
    maxNumOfPoints: 0,
  };
  #data: Array<kDataPoint>;

  constructor(config?: DeepPartial<kDataConfig>) {
    this.#data = [];
    if (config) this.setConfig(config);
  }

  setConfig(config: DeepPartial<kDataConfig>) {
    this.#config = merge(this.#config, config);
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

  get data() {
    return this.#data;
  }

  get label() {
    return this.#config.label;
  }

  get maxNumOfPoints() {
    return this.#config.maxNumOfPoints;
  }
}

export { kData as default };
