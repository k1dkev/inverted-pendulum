declare global {
  interface CanvasRenderingContext2D {
    rectBorderInside(x: number, y: number, w: number, h: number, t: number): CanvasRenderingContext2D;
  }
}

CanvasRenderingContext2D.prototype.rectBorderInside = function (
  x: number,
  y: number,
  w: number,
  h: number,
  t: number
): CanvasRenderingContext2D {
  this.fillRect(x, y, w, t); // top
  this.fillRect(x, y + h - t, w, t); // bottom
  this.fillRect(x, y, t, h); // left
  this.fillRect(x + w - t, y, t, h); // right
  return this;
};

export {};
