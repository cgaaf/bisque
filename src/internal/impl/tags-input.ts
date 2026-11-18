// What TagsInput (src/tags-input/tags-input.rx) needs from outside .rx: splitting typed and pasted text into
// entries, deciding which entries are accepted, and reading the input's caret. No DOM work beyond that: the input
// keeps focus throughout, so nothing here moves it.

/** Why an entry was refused. */
export type TagsInputInvalidReason = "duplicate" | "max" | "invalid";

export type TagsInputInvalidDetails = { value: string; reason: TagsInputInvalidReason };

export type TagsInputRules = {
  allowDuplicates: boolean;
  max: number | undefined;
  validate: ((value: string) => boolean) | undefined;
};

export type TagsInputPlan = { next: string[]; refused: TagsInputInvalidDetails[] };

/**
 * Typed text split at `delimiter`: every part followed by a delimiter is a finished entry (trimmed, empty ones
 * dropped); what follows the last delimiter is still being typed. With no delimiter nothing is finished.
 */
export function splitTyped(
  text: string,
  delimiter: string | null | undefined,
): { entries: string[]; rest: string } {
  if (!delimiter || !text.includes(delimiter)) return { entries: [], rest: text };
  const parts = text.split(delimiter);
  const rest = parts.pop() ?? "";
  return { entries: parts.map((part) => part.trim()).filter((part) => part !== ""), rest };
}

/** Pasted text as entries: split at `delimiter` and at line breaks, trimmed, empty ones dropped. */
export function splitPasted(text: string, delimiter: string | null | undefined): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  const parts = delimiter ? lines.flatMap((line) => line.split(delimiter)) : lines;
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

/**
 * Adds `entries` to `current` in order, each checked against what is accepted so far: a duplicate (unless
 * `allowDuplicates`), one past `max`, then one `validate` rejects, is refused with that reason.
 */
export function planEntries(entries: string[], current: string[], rules: TagsInputRules): TagsInputPlan {
  const next = [...current];
  const refused: TagsInputInvalidDetails[] = [];
  for (const raw of entries) {
    const value = raw.trim();
    if (value === "") continue;
    if (!rules.allowDuplicates && next.includes(value)) refused.push({ value, reason: "duplicate" });
    else if (rules.max !== undefined && next.length >= rules.max) refused.push({ value, reason: "max" });
    else if (rules.validate && !rules.validate(value)) refused.push({ value, reason: "invalid" });
    else next.push(value);
  }
  return { next, refused };
}

/** What the input shows after entries were submitted: the refused ones (to correct), then what is still typed. */
export function leftoverText(
  refused: TagsInputInvalidDetails[],
  rest: string,
  delimiter: string | null | undefined,
): string {
  const kept = refused.map((entry) => entry.value);
  if (kept.length === 0) return rest;
  const joined = kept.join(delimiter || " ");
  return rest === "" ? joined : `${joined}${delimiter || " "}${rest}`;
}

/** `list` without the entry at `index`. */
export function withoutIndex(list: string[], index: number): string[] {
  return list.filter((_, i) => i !== index);
}

/** Whether the input's caret is at its very start, with nothing selected. */
export function caretAtStart(input: HTMLInputElement | undefined): boolean {
  return input !== undefined && input.selectionStart === 0 && input.selectionEnd === 0;
}

/** The input's text with `pasted` put in place of its selection, as the paste would have left it. */
export function textWithPaste(input: HTMLInputElement, pasted: string): string {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  return input.value.slice(0, start) + pasted + input.value.slice(end);
}

/** The plain text a paste carries. */
export function pastedText(event: ClipboardEvent): string {
  return event.clipboardData?.getData("text/plain") ?? "";
}
