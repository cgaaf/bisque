// Generated from tags-input.d.rx by scripts/gen-dts.mjs. Do not edit.
export declare function splitTyped(text: string, delimiter: string | null | undefined): { entries: string[]; rest: string };
export declare function splitPasted(text: string, delimiter: string | null | undefined): string[];
export declare function planEntries(entries: string[], current: string[], rules: import("./impl/tags-input.ts").TagsInputRules): import("./impl/tags-input.ts").TagsInputPlan;
export declare function leftoverText(refused: import("./impl/tags-input.ts").TagsInputInvalidDetails[], rest: string, delimiter: string | null | undefined): string;
export declare function withoutIndex(list: string[], index: number): string[];
export declare function caretAtStart(input: HTMLInputElement | undefined): boolean;
export declare function textWithPaste(input: HTMLInputElement, pasted: string): string;
export declare function pastedText(event: ClipboardEvent): string;
