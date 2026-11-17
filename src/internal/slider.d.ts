// Generated from slider.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function isRangeValue(value: number | number[] | undefined): boolean;
export declare function sliderValues(value: number | number[] | undefined, min: number, max: number): number[];
export declare function formatSliderValue(value: number, locale: string | string[] | undefined, format: Intl.NumberFormatOptions | undefined): string;
export declare function valueToPercent(value: number, min: number, max: number): number;
export declare function sameValues(a: number[], b: number[]): boolean;
export declare function hasMinDistance(values: number[], step: number, minStepsBetweenValues: number): boolean;
export declare function moveThumb(values: number[], index: number, value: number, min: number, max: number): number[];
export declare function thumbKeyValue(key: string, shift: boolean, values: number[], index: number, min: number, max: number, step: number, largeStep: number, minStepsBetweenValues: number): number | null;
export declare function createSliderPointer(control: HTMLElement | undefined, options: { values: number[]; min: number; max: number; step: number; minStepsBetweenValues: number; orientation: "horizontal" | "vertical"; disabled: boolean }, onChange: (values: number[], thumb: number, reason: "track-press" | "drag") => void, onCommit: (values: number[], reason: "track-press" | "drag") => void, onDragging: (dragging: boolean) => void): void;
