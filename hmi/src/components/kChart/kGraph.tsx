import { kLayout, DeepPartial, ExcludeMethods, randColor, kBorder } from "./kChartInterfaces";
import { merge } from "lodash";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
export interface kGraphInterface {
  readonly layout: kLayout;
  readonly border: kBorder;
  updateOptions(options?: DeepPartial<kGraphOptions>): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

export interface kGraphOptions extends ExcludeMethods<kGraphInterface> {}

//----------------------------------------------------------------------------------------------------------------------
//                                                  Class
//----------------------------------------------------------------------------------------------------------------------
export class kGraph implements kGraphInterface {
  #options: kGraphOptions;

  constructor(options?: DeepPartial<kGraphOptions>) {
    this.#options = {
      layout: {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      },
      border: { show: false, color: randColor(), thickness: 1 },
    };
    this.updateOptions(options);
  }

  updateOptions(options?: DeepPartial<kGraphOptions>) {
    this.#options = merge(this.#options, options);
  }

  get layout() {
    return this.#options.layout;
  }

  get border() {
    return this.#options.border;
  }

  private translateAndClear(ctx: CanvasRenderingContext2D) {
    ctx.translate(this.layout.x, this.layout.y);
    ctx.beginPath();
    ctx.rect(0, 0, this.layout.width, this.layout.height);
    ctx.clip();
  }

  private drawBorder(ctx: CanvasRenderingContext2D) {
    if (!this.border.show) return;
    ctx.fillStyle = this.border.color;
    ctx.rectBorderInside(0, 0, this.layout.width, this.layout.height, this.border.thickness);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    this.translateAndClear(ctx);
    this.drawBorder(ctx);
    ctx.restore();
  }
}
