export type kDrawLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export enum drawPosition {
  top = "top",
  bottom = "bottom",
  left = "left",
  right = "right",
}

export class kDrawCoordinator {
  x: number = 0;
  y: number = 0;
  width: number = 100;
  height: number = 100;
  #unassigned: kDrawLayout = { x: 0, y: 0, width: 0, height: 0 };

  refresh() {
    this.#unassigned = { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  get freeArea() {
    return this.#unassigned;
  }

  placeOnScreen(objectLayout: kDrawLayout, position: drawPosition) {
    let x, y, width, height;
    if (position === drawPosition.top) {
      x = this.#unassigned.x;
      y = this.#unassigned.y;
      width = this.#unassigned.width;
      height = objectLayout.height;
      this.#unassigned.y = this.#unassigned.y + objectLayout.height;
      this.#unassigned.height = this.#unassigned.height - objectLayout.height;
    } else if (position === drawPosition.bottom) {
      x = this.#unassigned.x;
      y = this.#unassigned.y + this.#unassigned.height - objectLayout.height;
      width = this.#unassigned.width;
      height = objectLayout.height;
      this.#unassigned.height = this.#unassigned.height - objectLayout.height;
    } else if (position === drawPosition.left) {
      x = this.#unassigned.x;
      y = this.#unassigned.y;
      width = objectLayout.width;
      height = this.#unassigned.height;
      this.#unassigned.x = this.#unassigned.x + objectLayout.width;
      this.#unassigned.width = this.#unassigned.width - objectLayout.width;
    } else if (position === drawPosition.right) {
      x = this.#unassigned.x + this.#unassigned.width - objectLayout.width;
      y = this.#unassigned.y;
      width = objectLayout.width;
      height = this.#unassigned.height;
      this.#unassigned.width = this.#unassigned.width - objectLayout.width;
    } else {
      throw new Error("Invalid position type provided.");
    }
    return { x: x, y: y, width: width, height: height };
  }
}

//   label: string = "default label";
//   maxNumOfPoints: number = 100;
//   dataset: Array<kDataPoint> = [];

//   addDataPoint(point: kDataPoint) {
//     this.dataset.push(point);
//     while (this.dataset.length > this.maxNumOfPoints) {
//       this.dataset.pop();
//     }
//   }

//   clearData() {
//     this.dataset = [];
//   }
// }
