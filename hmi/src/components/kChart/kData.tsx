import "./CanvasRenderingContext2D.extensions";

interface kDataPoint {
  readonly x: number;
  readonly y: number;
}

export class kData {
  label: string = "default label";
  maxNumOfPoints: number = 100;
  dataset: Array<kDataPoint> = [];

  addDataPoint(point: kDataPoint) {
    this.dataset.push(point);
    while (this.dataset.length > this.maxNumOfPoints) {
      this.dataset.pop();
    }
  }

  clearData() {
    this.dataset = [];
  }
}
