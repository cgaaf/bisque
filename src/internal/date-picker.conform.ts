// Generated from date-picker.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
import type { Accessor } from "solid-js";

type Implementation = typeof import("./impl/date-picker.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["mergeOuterProps"], (internal: any, external: any) => any>,
  Conforms<Implementation["createRangeValidity"], (start: Accessor<HTMLInputElement | undefined>, end: Accessor<HTMLInputElement | undefined>, startMessage: Accessor<string>, endMessage: Accessor<string>, key: Accessor<string>) => void>,
  Conforms<Implementation["createFocusReturn"], (popup: Accessor<HTMLElement | undefined>, trigger: Accessor<HTMLElement | undefined>, open: Accessor<boolean>) => void>,
  Conforms<Implementation["afterOtherResets"], (run: (() => void)) => void>,
];
