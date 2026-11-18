// Generated from splitter.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/splitter.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["encodePanel"], (id: string, defaultSize: number | undefined, minSize: number, maxSize: number, collapsible: boolean, collapsedSize: number) => string>,
  Conforms<Implementation["isCollapsed"], (size: number | undefined, panel: import("./impl/splitter.ts").SplitterPanelSpec | undefined) => boolean>,
  Conforms<Implementation["resolveLayout"], (sizes: number[] | undefined, ids: string[], panels: import("./impl/splitter.ts").SplitterPanelSpec[]) => number[]>,
  Conforms<Implementation["initialLayout"], (panels: import("./impl/splitter.ts").SplitterPanelSpec[], defaultSizes: number[] | undefined) => number[]>,
  Conforms<Implementation["sameSizes"], (a: number[], b: number[]) => boolean>,
  Conforms<Implementation["handleLimit"], (layout: number[], panels: import("./impl/splitter.ts").SplitterPanelSpec[], handle: number, end: "min" | "max") => number>,
  Conforms<Implementation["keyLayout"], (key: string, layout: number[], panels: import("./impl/splitter.ts").SplitterPanelSpec[], handle: number, step: number, orientation: "horizontal" | "vertical", rtl: boolean) => number[] | null>,
  Conforms<Implementation["collapseTarget"], (panels: import("./impl/splitter.ts").SplitterPanelSpec[], handle: number) => number>,
  Conforms<Implementation["toggleCollapse"], (layout: number[], panels: import("./impl/splitter.ts").SplitterPanelSpec[], index: number, restore: number | undefined) => number[]>,
  Conforms<Implementation["restoreSizeFor"], (list: import("./impl/splitter.ts").SplitterRestore[], id: string) => number | undefined>,
  Conforms<Implementation["rememberCollapsed"], (list: import("./impl/splitter.ts").SplitterRestore[], panels: import("./impl/splitter.ts").SplitterPanelSpec[], before: number[], after: number[]) => import("./impl/splitter.ts").SplitterRestore[]>,
  Conforms<Implementation["panelIds"], (panels: import("./impl/splitter.ts").SplitterPanelSpec[]) => string[]>,
  Conforms<Implementation["panelIndex"], (panels: import("./impl/splitter.ts").SplitterPanelSpec[], id: string) => number>,
  Conforms<Implementation["handleBefore"], (items: import("./impl/splitter.ts").SplitterItems, id: string) => number>,
  Conforms<Implementation["roundSize"], (size: number | undefined) => number | undefined>,
  Conforms<Implementation["panelGrow"], (size: number | undefined, fallback: number | undefined) => string>,
  Conforms<Implementation["isRightToLeft"], (element: Element | null | undefined) => boolean>,
  Conforms<Implementation["createSplitterRegistry"], (root: Accessor<HTMLElement | undefined>) => Accessor<import("./impl/splitter.ts").SplitterItems>>,
  Conforms<Implementation["createSplitterDrag"], (root: Accessor<HTMLElement | undefined>, options: Accessor<{ layout: number[]; items: import("./impl/splitter.ts").SplitterItems; orientation: "horizontal" | "vertical"; disabled: boolean }>, onChange: (sizes: number[]) => void, onCommit: (sizes: number[]) => void, onDragging: (handle: string) => void) => void>,
];
