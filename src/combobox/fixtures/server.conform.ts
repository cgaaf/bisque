// Generated from server.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
type Implementation = typeof import("./server.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Fruit = { value: string; label: string; query: string; answer: number };
export type Checked = [
  Conforms<Implementation["search"], (query: string) => Promise<Fruit[]>>,
  Conforms<Implementation["loadAll"], () => Promise<Fruit[]>>,
];
