// Generated from site.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/site.ts") & typeof import("./impl/highlight.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["highlight"], (code: string, lang: string) => string>,
  Conforms<Implementation["prose"], (text: string) => string>,
  Conforms<Implementation["sourceOf"], (path: string) => Accessor<string>>,
  Conforms<Implementation["highlightedSourceOf"], (path: string) => Accessor<string>>,
  Conforms<Implementation["apiOf"], (family: string) => Accessor<any>>,
  Conforms<Implementation["navigation"], () => any>,
  Conforms<Implementation["pagePath"], () => string>,
  Conforms<Implementation["href"], (path: string) => string>,
  Conforms<Implementation["neighbours"], () => any>,
  Conforms<Implementation["headings"], () => Accessor<any>>,
  Conforms<Implementation["setTitle"], (title: string) => void>,
  Conforms<Implementation["toggleTheme"], () => void>,
  Conforms<Implementation["copyText"], (text: string) => Promise<void>>,
];
