// Generated from native.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/native.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["createNativeDialog"], (element: Accessor<HTMLDialogElement | undefined>, open: Accessor<boolean>, modal: Accessor<boolean>, onRequestClose: (reason: "escape-key" | "outside-press" | "close") => void) => void>,
  Conforms<Implementation["createNativePopover"], (element: Accessor<HTMLElement | undefined>, open: Accessor<boolean>, source: Accessor<HTMLElement | undefined>, onOpenChange: (open: boolean) => void) => void>,
  Conforms<Implementation["anchoredStyle"], (side: "top" | "bottom" | "left" | "right", align: "start" | "center" | "end", sideOffset: number, alignOffset: number) => any>,
  Conforms<Implementation["createPlacement"], (element: Accessor<HTMLElement | undefined>, anchor: Accessor<HTMLElement | undefined>, open: Accessor<boolean>) => Accessor<any>>,
  Conforms<Implementation["arrowStyle"], (placement: any) => any>,
];
