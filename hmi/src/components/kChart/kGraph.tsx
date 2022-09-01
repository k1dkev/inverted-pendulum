import { kLayout, DeepPartial, ExcludeMethods } from "./kChartInterfaces";
import { merge } from "lodash";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
interface kGraphInterface {
  readonly ctx: CanvasRenderingContext2D;
  readonly layout: kLayout;
  readonly showOutline: boolean;
  updateOptions(options?: DeepPartial<kGraphOptions>): void;
  draw(): void;
}

interface kGraphOptions extends Omit<ExcludeMethods<kGraphInterface>, "ctx"> {}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
class kGraph implements kGraphInterface {
  #options: kGraphOptions = {
    layout: {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    },
    showOutline: false,
  };
  #ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D, options?: DeepPartial<kGraphOptions>) {
    this.#ctx = ctx;
    this.updateOptions(options);
  }

  get ctx() {
    return this.#ctx;
  }

  get layout() {
    return this.#options.layout;
  }

  get showOutline() {
    return this.#options.showOutline;
  }

  updateOptions(options?: DeepPartial<kGraphOptions>) {
    this.#options = merge(this.#options, options);
  }

  private drawOutline() {
    if (!this.showOutline) return;
    this.ctx.beginPath();
    this.ctx.fillStyle = "blue";
    this.ctx.rectBorderInside(0, 0, this.layout.width, this.layout.height, 1);
    this.ctx.fill();
  }

  draw() {
    // save
    this.ctx.save();

    // Transform and clip
    this.ctx.translate(this.layout.x, this.layout.y);
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.layout.width, this.layout.height);
    this.ctx.clip();

    // Outline
    this.drawOutline();

    // restore
    this.ctx.restore();
  }
}

export { kGraph as default };
