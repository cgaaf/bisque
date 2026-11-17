// Generated from composite-focus.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/composite-focus.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createCompositeFocus"], (container: Accessor<HTMLElement | undefined>, options: Accessor<{ orientation: "horizontal" | "vertical"; loop: boolean; homeEnd: boolean }>) => void>,
];
