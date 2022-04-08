import kAxis from "./kAxis";

// For calling ctx functions and applying scaling and shifting
CanvasRenderingContext2D.prototype.rectBorderInside = function (x, y, w, h, t) {
  this.rect(x, y, w, t); // top
  this.rect(x, y + h - t, w, t); // bottom
  this.rect(x, y, t, h); // left
  this.rect(x + w - t, y, t, h); // right
  return this;
};

//------------------------------------------------------------------------------------
//                                kChart
//------------------------------------------------------------------------------------
class kChart {
  constructor({ numOfPoints, W, H, margin, aspectRatio } = {}) {
    this.aspectRatio = aspectRatio || 1.5;
    this.totalWidth = W || 1000;
    this.totalHeight = H || 1000;
    this.numOfPoints = numOfPoints || 100;
    this.margin = margin || 10;
    this.W = this.totalWidth - 2 * this.margin;
    this.H = this.totalHeight - 2 * this.margin;
    this.axis = new kAxis({ showOutline: true });
  }

  drawLine(ctx, t) {
    ctx.moveTo(0, this.H / 2);
    ctx.beginPath();
    for (let i = 0; i <= this.numOfPoints; i++) {
      let x = (i * this.W) / this.numOfPoints;
      let y = (this.H / 4) * Math.sin(x / 100 + t / 500) + this.H / 2;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  drawAroundCanvas(ctx, t) {
    ctx.beginPath();
    ctx.rect(0.5, 0.5, this.totalWidth - 1, this.totalHeight - 1);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  draw(canvas, t) {
    let ctx = canvas.getContext("2d");
    this.totalWidth = Math.floor(canvas.offsetWidth);
    this.totalHeight = Math.floor(canvas.offsetWidth / this.aspectRatio);
    ctx.canvas.width = this.totalWidth;
    ctx.canvas.height = this.totalHeight;
    this.W = this.totalWidth - 2 * this.margin;
    this.H = this.totalHeight - 2 * this.margin;

    // Save current transform and transform
    let storedTransform = ctx.getTransform();

    // Draw line
    this.drawLine(ctx, t);

    // Draw canvas outline
    this.drawAroundCanvas(ctx, t);

    // draw axis
    this.axis.updateConfig({
      pos: { availableHeight: this.totalHeight - 2 * this.margin, x: this.margin, y: this.margin },
      options: { showOutline: true },
    });
    this.axis.draw(ctx);

    // reset transform to stored
    ctx.setTransform(storedTransform);
  }
}

export { kChart as default };
