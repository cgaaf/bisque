// Generated from table-of-contents.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/table-of-contents.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["targetId"], (href: string | undefined) => string | undefined>,
  Conforms<Implementation["createScrollSpy"], (ids: Accessor<string[]>, container: Accessor<HTMLElement | undefined>, offset: Accessor<number>, onChange: (id: string | undefined) => void) => [Accessor<string | undefined>, (id: string) => void]>,
  Conforms<Implementation["createTableOfContents"], (nav: Accessor<HTMLElement | undefined>, container: Accessor<HTMLElement | undefined>, offset: Accessor<number>, onChange: (id: string | undefined) => void) => Accessor<string | undefined>>,
  Conforms<Implementation["createActiveLinkRect"], (nav: Accessor<HTMLElement | undefined>, activeId: Accessor<string | undefined>) => Accessor<{ top: number; left: number; width: number; height: number } | undefined>>,
];
