import kAxis from "./kAxis";

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

export interface DataPoint {
  readonly x: number;
  readonly y: number;
}

export interface Dataset {
  readonly label: string;
  readonly data: Array<DataPoint>;
}

export interface Pen {
  readonly label: string;
  readonly dataset: Dataset;
  readonly display: boolean;
  readonly color: string;
  readonly axis: kAxis;
}

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export default {};
