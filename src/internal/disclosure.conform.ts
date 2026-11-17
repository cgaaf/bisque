// Generated from disclosure.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/disclosure.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createDisclosure"], (element: Accessor<HTMLDetailsElement | undefined>, panel: Accessor<HTMLElement | undefined>, open: Accessor<boolean>, prefix: string, onOpenChange: (open: boolean) => void) => void>,
  Conforms<Implementation["focusAdjacentTrigger"], (event: KeyboardEvent, orientation: "horizontal" | "vertical", loop: boolean) => void>,
];
