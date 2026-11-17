// Generated from scroll-area.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/scroll-area.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createScrollMetrics"], (viewport: Accessor<HTMLElement | undefined>, scrollbarY: Accessor<HTMLElement | undefined>, scrollbarX: Accessor<HTMLElement | undefined>) => { top: number; left: number; scrollHeight: number; scrollWidth: number; clientHeight: number; clientWidth: number; trackY: number; thicknessY: number; trackX: number; thicknessX: number; scrollingX: boolean; scrollingY: boolean }>,
  Conforms<Implementation["setScrollPosition"], (element: HTMLElement | undefined, axis: "x" | "y", value: number) => void>,
  Conforms<Implementation["capturePointer"], (element: HTMLElement | undefined, pointerId: number) => void>,
  Conforms<Implementation["releasePointer"], (element: HTMLElement | undefined, pointerId: number) => void>,
];
