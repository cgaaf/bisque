// Generated from slider.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/slider.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["isRangeValue"], (value: number | number[] | undefined) => boolean>,
  Conforms<Implementation["sliderValues"], (value: number | number[] | undefined, min: number, max: number) => number[]>,
  Conforms<Implementation["formatSliderValue"], (value: number, locale: string | string[] | undefined, format: Intl.NumberFormatOptions | undefined) => string>,
  Conforms<Implementation["valueToPercent"], (value: number, min: number, max: number) => number>,
  Conforms<Implementation["sameValues"], (a: number[], b: number[]) => boolean>,
  Conforms<Implementation["hasMinDistance"], (values: number[], step: number, minStepsBetweenValues: number) => boolean>,
  Conforms<Implementation["moveThumb"], (values: number[], index: number, value: number, min: number, max: number) => number[]>,
  Conforms<Implementation["thumbKeyValue"], (key: string, shift: boolean, values: number[], index: number, min: number, max: number, step: number, largeStep: number, minStepsBetweenValues: number) => number | null>,
  Conforms<Implementation["createSliderPointer"], (control: Accessor<HTMLElement | undefined>, options: Accessor<{ values: number[]; min: number; max: number; step: number; minStepsBetweenValues: number; orientation: "horizontal" | "vertical"; disabled: boolean }>, onChange: (values: number[], thumb: number, reason: "track-press" | "drag") => void, onCommit: (values: number[], reason: "track-press" | "drag") => void, onDragging: (dragging: boolean) => void) => void>,
];
