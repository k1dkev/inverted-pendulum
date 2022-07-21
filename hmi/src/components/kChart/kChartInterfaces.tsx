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

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export default {};
