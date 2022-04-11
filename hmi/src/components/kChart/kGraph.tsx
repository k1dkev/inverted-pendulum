import { kBase } from "./kChartInterfaces";

//------------------------------------------------------------------------------------
//                                Interfaces
//------------------------------------------------------------------------------------
interface kGraphData extends kBase {
  readonly numOfPoints: number;
}

interface kGraphConfig extends Omit<kGraphData, "ctx"> {}

//------------------------------------------------------------------------------------
//                                Classes
//------------------------------------------------------------------------------------
class kGraph implements kGraphData {
  #config: kGraphConfig = {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    showOutline: false,
    numOfPoints: 100,
  };
  #ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D, config?: Partial<kGraphConfig>) {
    this.#ctx = ctx;
    if (config) this.setConfig(config);
  }

  setConfig(config: Partial<kGraphConfig>) {
    this.#config = { ...this.#config, ...config };
  }

  get ctx() {
    return this.#ctx;
  }

  get x() {
    return this.#config.x;
  }

  get y() {
    return this.#config.y;
  }

  get width() {
    return this.#config.width;
  }

  get height() {
    return this.#config.height;
  }

  get margin() {
    return this.#config.margin;
  }

  get showOutline() {
    return this.#config.showOutline;
  }

  get numOfPoints() {
    return this.#config.numOfPoints;
  }

  drawLine(t: number) {
    this.ctx.moveTo(0, this.height / 2);
    this.ctx.beginPath();
    for (let i = 0; i <= this.numOfPoints; i++) {
      let x = (i * this.width) / this.numOfPoints;
      let y = (this.height / 4) * Math.sin(x / 100 + t / 500) + this.height / 2;
      this.ctx.lineTo(x, y);
    }
    this.ctx.lineWidth = 3;
    this.ctx.stroke();
  }

  drawOutline() {
    if (!this.showOutline) return;
    this.ctx.beginPath();
    this.ctx.fillStyle = "blue";
    this.ctx.rectBorderInside(0, 0, this.width, this.height, 1);
    this.ctx.fill();
  }

  draw(t: number) {
    const storedTransform = this.ctx.getTransform();
    this.ctx.translate(this.x, this.y);
    this.drawLine(t);
    this.drawOutline();
    this.ctx.setTransform(storedTransform);
  }
}

export { kGraph as default };
