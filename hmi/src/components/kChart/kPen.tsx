Pen Class
    - label
    - dataset reference
    - display/draw/show
    - color
    - axis reference

import "./CanvasRenderingContext2D.extensions";
import { DeepPartial } from "./kChartInterfaces";
import { merge, truncate } from "lodash";
import kAxis from "./kAxis";
import kData from "./kData";


//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
interface kPenData {
  readonly show: boolean;
  readonly label: string;
  readonly color: string;
  readonly Data: kData;
  readonly Axis: kAxis;
}

interface kPenConfig extends Omit<kPenData, "Data" | "Axis"> {
  readonly Data?: kData;
  readonly Axis?: kAxis;  
}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
class kPen implements kPenData {
  #config: kPenConfig = {
    show: true,
    label: "",
    color: "black",
    Data: undefined,
    Axis: undefined
  };

  constructor(config?: DeepPartial<kPenConfig>) {
    if (config) this.setConfig(config);
  }

  setConfig(config: DeepPartial<kPenConfig>) {
    this.#config = merge(this.#config, config);
  }

  get show() {
    return this.#config.show;
  }

  get label () {
    return this.#config.label;
  }

  get color () {
    return this.#config.color;
  }

  get Data () {
    return this.#config.Data;
  }
  
  get Axis () {
    return this.#config.Axis;
  }
}

export { kPen as default };
