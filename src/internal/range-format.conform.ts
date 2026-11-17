// Generated from range-format.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
type Implementation = typeof import("./impl/range-format.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["rangeValue"], (value: number | null | undefined, min: number, max: number, locale: string | string[] | undefined, format: Intl.NumberFormatOptions | undefined) => { clamped: number | null; percent: number | null; formatted: string }>,
];
