// Generated from slow-server.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
type Implementation = typeof import("./slow-server.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["fetchText"], (key: string) => Promise<string>>,
  Conforms<Implementation["fetchList"], (key: string) => Promise<string[]>>,
  Conforms<Implementation["save"], (key: string) => Promise<string>>,
];
