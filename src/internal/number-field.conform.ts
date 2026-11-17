// Generated from number-field.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/number-field.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["formatNumberValue"], (value: number | null | undefined, locale: string | string[] | undefined, format: Intl.NumberFormatOptions | undefined) => string>,
  Conforms<Implementation["parseNumberText"], (text: string, locale: string | string[] | undefined, format: Intl.NumberFormatOptions | undefined) => number | null>,
  Conforms<Implementation["isNumberText"], (text: string, locale: string | string[] | undefined, format: Intl.NumberFormatOptions | undefined, allowNegative: boolean) => boolean>,
  Conforms<Implementation["validateNumber"], (value: number | null, step: number | undefined, min: number | undefined, max: number | undefined, format: Intl.NumberFormatOptions | undefined, snapOnStep: boolean, small: boolean, clamp: boolean) => number | null>,
  Conforms<Implementation["isFocused"], (element: HTMLElement | undefined) => boolean>,
  Conforms<Implementation["focusInputEnd"], (element: HTMLInputElement | undefined) => void>,
  Conforms<Implementation["restoreInputText"], (element: HTMLInputElement, text: string) => void>,
  Conforms<Implementation["createPressAndHold"], (disabled: Accessor<boolean>, tick: (event: MouseEvent) => void, onStop: (event: PointerEvent) => void) => { press: (event: PointerEvent) => void; release: (event: PointerEvent) => void; move: (event: PointerEvent) => void; enter: (event: MouseEvent) => void; leave: () => void; skipClick: (event: MouseEvent) => boolean }>,
  Conforms<Implementation["createScrub"], (area: Accessor<HTMLElement | undefined>, cursor: Accessor<HTMLElement | undefined>, options: Accessor<{ enabled: boolean; direction: "horizontal" | "vertical"; pixelSensitivity: number; teleportDistance: number | undefined }>, onScrubbing: (scrubbing: boolean) => void, onStep: (delta: number, event: PointerEvent) => void, onEnd: (event: PointerEvent) => void) => { scrubbing: boolean; x: number; y: number; cursor: boolean }>,
];
