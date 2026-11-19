// Generated from minimal-features.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
type Implementation = typeof import("./minimal-features.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["sortingFeatures"], () => unknown>,
];
