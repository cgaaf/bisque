// Generated from listbox-selection.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/listbox-selection.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["selectionValues"], (value: string | string[] | null | undefined) => string[]>,
  Conforms<Implementation["enabledValues"], (list: HTMLElement | undefined) => string[]>,
  Conforms<Implementation["valuesBetween"], (list: HTMLElement | undefined, from: string, to: string) => string[]>,
  Conforms<Implementation["focusedValue"], (list: HTMLElement | undefined) => string | undefined>,
  Conforms<Implementation["createSelectedTabStop"], (container: Accessor<HTMLElement | undefined>) => void>,
];
