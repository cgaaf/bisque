// Generated from settings-server.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
type Implementation = typeof import("./settings-server.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["save"], (key: string, value: any) => Promise<any>>,
  Conforms<Implementation["load"], (key: string, fallback: any) => Promise<any>>,
];
