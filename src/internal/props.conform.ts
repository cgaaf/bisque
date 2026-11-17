// Generated from props.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
type Implementation = typeof import("./impl/props.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["mergeProps"], (internal: any, external: any) => any>,
  Conforms<Implementation["withoutHandlers"], (external: any, disabled: boolean) => any>,
  Conforms<Implementation["createId"], (prefix: string) => string>,
  Conforms<Implementation["preventDefaultBehavior"], (event: Event) => void>,
  Conforms<Implementation["createRef"], (set: (element: any) => void) => (element: any) => void>,
];
