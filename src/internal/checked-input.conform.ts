// Generated from checked-input.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/checked-input.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createCheckedInput"], (element: Accessor<HTMLInputElement | undefined>, checked: Accessor<boolean>, indeterminate: Accessor<boolean>, revision: Accessor<number>) => void>,
];
