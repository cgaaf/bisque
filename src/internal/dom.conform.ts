// Generated from dom.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/dom.ts") & typeof import("./impl/roving.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createPresence"], (present: Accessor<boolean>, element: Accessor<HTMLElement | undefined>) => [Accessor<boolean>, Accessor<"starting" | "ending" | undefined>]>,
  Conforms<Implementation["createKeptFocus"], (container: Accessor<HTMLElement | undefined>, active: Accessor<boolean>) => void>,
  Conforms<Implementation["createRovingFocus"], (container: Accessor<HTMLElement | undefined>, options: Accessor<{ orientation: "horizontal" | "vertical" | "both"; loop: boolean; typeahead: boolean; tabStop: boolean }>) => void>,
  Conforms<Implementation["focusElement"], (element: HTMLElement | undefined) => void>,
  Conforms<Implementation["clickElement"], (element: HTMLElement | undefined) => void>,
  Conforms<Implementation["focusListItem"], (container: HTMLElement | undefined, which: "first" | "last" | "current") => void>,
];
