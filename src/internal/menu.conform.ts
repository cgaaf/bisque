// Generated from menu.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/menu.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createMenuFocus"], (active: Accessor<boolean>, popup: Accessor<HTMLElement | undefined>, initialFocus: Accessor<"none" | "container" | "first-item" | "last-item">, returnTo: Accessor<HTMLElement | undefined>, restore: Accessor<boolean>) => void>,
  Conforms<Implementation["afterRelease"], (open: () => void) => void>,
  Conforms<Implementation["afterPointerRelease"], (event: MouseEvent, open: () => void) => void>,
  Conforms<Implementation["createLongPress"], (enabled: Accessor<boolean>, element: Accessor<HTMLElement | undefined>, delay: number, onLongPress: (x: number, y: number) => void) => void>,
  Conforms<Implementation["adjacentItem"], (bar: HTMLElement | undefined, from: HTMLElement | undefined, direction: number, loop: boolean) => HTMLElement | undefined>,
  Conforms<Implementation["elementCorner"], (element: HTMLElement | undefined) => { x: number; y: number }>,
];
