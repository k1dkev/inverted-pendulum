export type kDrawLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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

  placeTop(elementHeight: number) {
    const placement = {
      x: this.#unassigned.x,
      y: this.#unassigned.y,
      width: this.#unassigned.width,
      height: elementHeight,
    };
    this.#unassigned.y = this.#unassigned.y + elementHeight;
    this.#unassigned.height = this.#unassigned.height - elementHeight;
    return placement;
  }

  placeBottom(elementHeight: number) {
    const placement = {
      x: this.#unassigned.x,
      y: this.#unassigned.y + this.#unassigned.height - elementHeight,
      width: this.#unassigned.width,
      height: elementHeight,
    };
    this.#unassigned.height = this.#unassigned.height - elementHeight;
    return placement;
  }

  placeLeft(elementWidth: number) {
    const placement = {
      x: this.#unassigned.x,
      y: this.#unassigned.y,
      width: elementWidth,
      height: this.#unassigned.height,
    };
    this.#unassigned.x = this.#unassigned.x + elementWidth;
    this.#unassigned.width = this.#unassigned.width - elementWidth;
    return placement;
  }

  placeRight(elementWidth: number) {
    const placement = {
      x: this.#unassigned.x + this.#unassigned.width - elementWidth,
      y: this.#unassigned.y,
      width: elementWidth,
      height: this.#unassigned.height,
    };
    this.#unassigned.width = this.#unassigned.width - elementWidth;
    return placement;
  }
}
