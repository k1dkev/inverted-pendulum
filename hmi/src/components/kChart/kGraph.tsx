//------------------------------------------------------------------------------------
//                                kGraphConfig
//------------------------------------------------------------------------------------
interface kGraphConfig {
  pos: {
    x: number;
    y: number;
    width: number;
    height: number;
    margin: number;
  };
  options: {
    showOutline: boolean;
  };
  numOfPoints: number;
}

//------------------------------------------------------------------------------------
//                                kAxisParams
//------------------------------------------------------------------------------------
interface kGraphParams {
  pos: {
    x: number;
    y: number;
    width: number;
    height: number;
    margin: number;
  };
}

//------------------------------------------------------------------------------------
//                                kGraph
//------------------------------------------------------------------------------------
class kGraph {
  #config: kGraphConfig;
  #params: kGraphParams;
  constructor() {
    this.#config = {
      pos: {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        margin: 10,
      },
      options: {
        showOutline: false,
      },
      numOfPoints: 100,
    };

    // this.updateConfig(config);

    this.#params = {
      pos: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        margin: 0,
      },
    };

    this.updateParams();
  }

  updateConfig(config: kGraphConfig) {
    this.#config = { ...this.#config, ...config };
  }

  get params() {
    return { ...this.#params };
  }

  get config() {
    return { ...this.#config };
  }

  updateParams() {
    // Positions
    this.#params.pos.x = this.#config.pos.x;
    this.#params.pos.y = this.#config.pos.y;
    this.#params.pos.width = this.#config.pos.width;
    this.#params.pos.height = this.#config.pos.height;
    this.#params.pos.margin = this.#config.pos.margin;
  }

  drawLine(ctx: CanvasRenderingContext2D, t: number) {
    ctx.moveTo(0, this.#config.pos.height / 2);
    ctx.beginPath();
    for (let i = 0; i <= this.#config.numOfPoints; i++) {
      let x = (i * this.#config.pos.width) / this.#config.numOfPoints;
      let y = (this.#config.pos.height / 4) * Math.sin(x / 100 + t / 500) + this.#config.pos.height / 2;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  drawOutline(ctx: CanvasRenderingContext2D) {
    if (!this.#config.options.showOutline) return;
    ctx.beginPath();
    ctx.fillStyle = "blue";
    ctx.rectBorderInside(0, 0, this.#params.pos.width, this.#params.pos.height, 1);
    ctx.fill();
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    const storedTransform = ctx.getTransform();
    ctx.translate(this.#params.pos.x, this.#params.pos.y);
    this.updateParams();
    this.drawLine(ctx, t);
    this.drawOutline(ctx);
    ctx.setTransform(storedTransform);
  }
}

export { kGraph as default };
