// Generated from tags-input.d.rx by scripts/gen-dts.mjs. Do not edit.
// An error here means the declaration and the implementation disagree: fix whichever is wrong.
type Implementation = typeof import("./impl/tags-input.ts");
type Conforms<Actual extends Declared, Declared> = Actual;
export type Checked = [
  Conforms<Implementation["splitTyped"], (text: string, delimiter: string | null | undefined) => { entries: string[]; rest: string }>,
  Conforms<Implementation["splitPasted"], (text: string, delimiter: string | null | undefined) => string[]>,
  Conforms<Implementation["planEntries"], (entries: string[], current: string[], rules: import("./impl/tags-input.ts").TagsInputRules) => import("./impl/tags-input.ts").TagsInputPlan>,
  Conforms<Implementation["leftoverText"], (refused: import("./impl/tags-input.ts").TagsInputInvalidDetails[], rest: string, delimiter: string | null | undefined) => string>,
  Conforms<Implementation["withoutIndex"], (list: string[], index: number) => string[]>,
  Conforms<Implementation["caretAtStart"], (input: HTMLInputElement | undefined) => boolean>,
  Conforms<Implementation["textWithPaste"], (input: HTMLInputElement, pasted: string) => string>,
  Conforms<Implementation["pastedText"], (event: ClipboardEvent) => string>,
];
