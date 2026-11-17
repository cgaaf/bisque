// Generated from tab-indicator.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/tab-indicator.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createSelectedTab"], (list: Accessor<HTMLElement | undefined>, value: Accessor<string | undefined>, orientation: Accessor<"horizontal" | "vertical">) => [Accessor<{ left: number; right: number; top: number; bottom: number; width: number; height: number } | undefined>, Accessor<"left" | "right" | "up" | "down" | "none">]>,
];
