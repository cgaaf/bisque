// Generated from swipe.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/swipe.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createSwipe"], (element: Accessor<HTMLElement | undefined>, options: Accessor<{ enabled: boolean; directions: ("up" | "down" | "left" | "right")[]; threshold: number; velocity: number; textSelector: string }>, onDismiss: (direction: "up" | "down" | "left" | "right") => void) => { swiping: boolean; direction: "up" | "down" | "left" | "right" | undefined; x: number; y: number; progress: number }>,
];
