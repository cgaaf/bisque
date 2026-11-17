// Generated from focus-keeper.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/focus-keeper.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createFocusKeeper"], (element: Accessor<HTMLElement | undefined>, disabled: Accessor<boolean>) => void>,
];
