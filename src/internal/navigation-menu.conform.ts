// Generated from navigation-menu.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/navigation-menu.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["activationDirection"], (from: HTMLElement | undefined, to: HTMLElement | undefined, orientation: "horizontal" | "vertical") => "left" | "right" | "up" | "down" | undefined>,
  Conforms<Implementation["containsTarget"], (elements: (HTMLElement | undefined)[], target: EventTarget | null) => boolean>,
  Conforms<Implementation["focusFirstIn"], (container: HTMLElement | undefined) => void>,
  Conforms<Implementation["createContentFocus"], (active: Accessor<boolean>, enter: Accessor<boolean>, content: Accessor<HTMLElement | undefined>, trigger: Accessor<HTMLElement | undefined>) => void>,
];
