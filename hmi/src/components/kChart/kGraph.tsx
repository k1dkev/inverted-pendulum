import { kLayout, DeepPartial, ExcludeMethods } from "./kChartInterfaces";
import { merge } from "lodash";

//----------------------------------------------------------------------------------------------------------------------
//                                                  Interfaces
//----------------------------------------------------------------------------------------------------------------------
export interface kGraphInterface {
  readonly layout: kLayout;
  readonly showOutline: boolean;
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
      showOutline: false,
    };
    this.updateOptions(options);
  }

  updateOptions(options?: DeepPartial<kGraphOptions>) {
    this.#options = merge(this.#options, options);
  }

  get layout() {
    return this.#options.layout;
  }

  get showOutline() {
    return this.#options.showOutline;
  }

  private drawOutline(ctx: CanvasRenderingContext2D) {
    if (!this.showOutline) return;
    ctx.beginPath();
    ctx.fillStyle = "blue";
    ctx.rectBorderInside(0, 0, this.layout.width, this.layout.height, 1);
    ctx.fill();
  }

  draw(ctx: CanvasRenderingContext2D) {
    // save
    ctx.save();

    // Transform and clip
    ctx.translate(this.layout.x, this.layout.y);
    ctx.beginPath();
    ctx.rect(0, 0, this.layout.width, this.layout.height);
    ctx.clip();

    // Outline
    this.drawOutline(ctx);

    // restore
    ctx.restore();
  }
}
