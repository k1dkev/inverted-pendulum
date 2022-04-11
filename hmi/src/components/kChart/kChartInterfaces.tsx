export interface kMargin {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export interface kLayout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly margin: kMargin;
}

export interface kBase extends kLayout {
  readonly ctx: CanvasRenderingContext2D;
  readonly showOutline: boolean;
}

export default {};
