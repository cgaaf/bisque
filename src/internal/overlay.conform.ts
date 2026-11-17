// Generated from overlay.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/overlay.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createHoverGroup"], (timeout: Accessor<number>) => any>,
  Conforms<Implementation["createHoverIntent"], (enabled: Accessor<boolean>, open: Accessor<boolean>, trigger: Accessor<HTMLElement | undefined>, popup: Accessor<HTMLElement | undefined>, options: Accessor<{ openDelay: number; closeDelay: number; hoverablePopup: boolean; focus: boolean; focusDelay: number; closeOnPress: boolean; group: any; stickOnPress?: boolean }>, onOpenChange: (open: boolean, reason: "hover" | "focus" | "press" | "group") => void) => void>,
  Conforms<Implementation["createManualDismiss"], (active: Accessor<boolean>, trigger: Accessor<HTMLElement | undefined>, popup: Accessor<HTMLElement | undefined>, onDismiss: (reason: "escape-key" | "outside-press") => void) => void>,
];
