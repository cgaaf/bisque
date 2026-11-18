/// <reference lib="esnext.temporal" />
// What Date Field and Time Field share beyond the date core (./date.ts): the field's value as a form string, its
// segment list with keys, and the DOM work on segments (moving focus, reading the direction, putting back text an
// uncancellable composition wrote, and the incomplete-value message on the hidden input). `../segmented-field.d.rx`
// declares how `.rx` may call it.
// (The reference is for oxlint's type-aware rules; see ./date.ts.)
import { createEffect, createSignal, type Accessor } from "solid-js";
import {
  isDateInRange,
  isTimeInRange,
  dateToSegments,
  dateToString,
  fieldSegments,
  parseDate,
  parseTime,
  segmentsToDate,
  segmentsToTime,
  timeToSegments,
  timeToString,
  type FieldOptions,
  type FieldSegment,
  type SegmentKind,
  type SegmentValues,
} from "./date.ts";

type PlainDate = Temporal.PlainDate;
type PlainTime = Temporal.PlainTime;

/** A segment with a key that stays the same while its value changes: its kind, or `literal-<index>` for a literal. */
export type KeyedSegment = FieldSegment & { key: string };

/**
 * The field's segments for a keyed list. A date has two literals of the same kind (`/` and `/`), so the kind alone
 * can't key the list; a literal is keyed by its position, which doesn't change while the locale doesn't.
 */
export function segmentList(values: SegmentValues, options: FieldOptions): KeyedSegment[] {
  return fieldSegments(values, options).map((segment, index) =>
    Object.assign(segment, { key: segment.kind === "literal" ? `literal-${index}` : segment.kind }),
  );
}

/** The segments the form string `text` (`2026-11-17`, `13:45`) makes; all empty for "" or bad text. */
export function segmentsOfText(text: string, options: FieldOptions): SegmentValues {
  if (options.type === "date") return dateToSegments(parseDate(text, undefined), options.calendar);
  return timeToSegments(parseTime(text));
}

/** The form string the segments make (`2026-11-17`; `13:45`, or `13:45:00` down to seconds); "" while incomplete. */
export function textOfSegments(values: SegmentValues, options: FieldOptions): string {
  if (options.type === "date") return dateToString(segmentsToDate(values, options));
  return timeToString(segmentsToTime(values, options), options.granularity ?? "minute");
}

/**
 * Whether the value `text` names is outside `[min, max]` (an undefined or empty bound is open); false for "" (no
 * value). All three are form strings: dates in a date field, times in a time field.
 */
export function isTextOutOfRange(
  text: string,
  min: string | undefined,
  max: string | undefined,
  options: FieldOptions,
): boolean {
  if (text === "") return false;
  if (options.type === "date") {
    return !isDateInRange(parseDate(text, undefined), parseDate(min, undefined), parseDate(max, undefined));
  }
  return !isTimeInRange(parseTime(text), parseTime(min), parseTime(max));
}

/** `bound` as the hidden input's `min` or `max` attribute; undefined for none. */
export function boundText(
  bound: PlainDate | PlainTime | undefined,
  options: FieldOptions,
): string | undefined {
  if (bound === undefined) return undefined;
  if (options.type === "date") return asDate(bound) ? dateToString(asDate(bound)) : undefined;
  return asTime(bound) ? timeToString(asTime(bound), "second") : undefined;
}

function asDate(value: PlainDate | PlainTime | undefined): PlainDate | undefined {
  return value !== undefined && "calendarId" in value ? value : undefined;
}

function asTime(value: PlainDate | PlainTime | undefined): PlainTime | undefined {
  return value !== undefined && !("calendarId" in value) ? value : undefined;
}

/** The digits segment `kind` shows (the hour on the clock face), as typed: "" while it is empty or a day period. */
export function shownDigits(values: SegmentValues, kind: SegmentKind, options: FieldOptions): string {
  if (kind === "dayPeriod") return "";
  const value = fieldSegments(values, options).find((segment) => segment.kind === kind)?.value;
  return value === undefined ? "" : String(value);
}

/**
 * An edit in progress: the segments typed, the value they make (`key`, "" while incomplete), the value the field
 * had when the edit was made (`base`), and whether the field has shown the edit's value since (`taken`).
 */
export type SegmentDraft = { key: string; base: string; values: SegmentValues; taken?: boolean };

/**
 * The field's edit in progress, given the value it shows. The edit lasts while the value is the one it made, or
 * still the one it started from: an owner that hasn't taken the change yet (its save is out) or keeps its value
 * while the field is partly filled. A value that becomes anything else ends it, and so does a return to the
 * starting value after the edit's own was shown (an optimistic save that failed, an owner setting the old value
 * again). A writable derived signal, so the edit ends in the flush the value changes in: an effect clearing it
 * would leave a frame showing the new value beside the old edit.
 */
export function createDraft(
  current: Accessor<string>,
): [Accessor<SegmentDraft | undefined>, (draft: SegmentDraft | undefined) => void] {
  const [draft, setDraft] = createSignal<SegmentDraft | undefined>((previous) => {
    const value = current();
    if (!previous) return undefined;
    if (previous.key === value) return previous.taken ? previous : { ...previous, taken: true };
    return previous.base === value && !previous.taken ? previous : undefined;
  });
  return [draft, (next) => setDraft(() => next)];
}

/** Whether any segment the field shows has a value. */
export function hasAnySegment(values: SegmentValues, options: FieldOptions): boolean {
  return fieldSegments(values, options).some((segment) => segment.editable && segment.value !== undefined);
}

/**
 * The form string of pasted or dropped `text` when it names a whole value (an ISO date `2026-11-17`, a time
 * `13:45` or `13:45:30`), in the field's granularity; undefined otherwise.
 */
export function textOfPaste(text: string | null | undefined, options: FieldOptions): string | undefined {
  if (!text) return undefined;
  const result = textOfSegments(segmentsOfText(text.trim(), options), options);
  return result === "" ? undefined : result;
}

/** The text on the clipboard of a paste event; null when there is none. */
export function pastedText(event: ClipboardEvent): string | null {
  return event.clipboardData?.getData("text/plain") ?? null;
}

// The segments a person can move to, in document order.
function editableSegments(input: HTMLElement): HTMLElement[] {
  return Array.from(input.querySelectorAll<HTMLElement>("[data-bisque-segment]:not([aria-hidden])"));
}

/**
 * Focuses the segment `step` places from `from` in document order (1 the next, -1 the previous), if there is one.
 * Returns whether focus moved.
 */
export function focusSegment(
  input: HTMLElement | undefined,
  from: HTMLElement | undefined,
  step: number,
): boolean {
  if (!input || !from) return false;
  const segments = editableSegments(input);
  const target = segments[segments.indexOf(from) + step];
  if (!target || !target.isConnected) return false;
  target.focus();
  return true;
}

/** Focuses the first empty segment, or the last segment when none is empty: where a click on the field leads. */
export function focusEntry(input: HTMLElement | undefined): void {
  if (!input) return;
  const segments = editableSegments(input);
  const target = segments.find((segment) => segment.hasAttribute("data-placeholder")) ?? segments.at(-1);
  target?.focus();
}

/** Focuses the first segment. */
export function focusFirst(input: HTMLElement | undefined): void {
  if (input) editableSegments(input)[0]?.focus();
}

/** Whether `element` lays out right to left. */
export function isRightToLeft(element: HTMLElement): boolean {
  return getComputedStyle(element).direction === "rtl";
}

/** Whether `target` is a segment the person can edit, rather than the field's empty space or a literal. */
export function isSegment(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.hasAttribute("data-bisque-segment") &&
    !target.hasAttribute("aria-hidden")
  );
}

/**
 * Puts back the segment's text after an edit the browser made itself. Typing is cancelled in `beforeinput`, but a
 * composition (an IME, some Android keyboards) can't be, and writes into the element.
 */
export function restoreText(element: HTMLElement, text: string): void {
  if (element.textContent === text) return;
  // The text node is the view's own (it writes the next value into it): keep it if it is still the only child.
  const node = element.firstChild;
  if (node instanceof Text && element.childNodes.length === 1) node.data = text;
  else element.textContent = text;
}

/**
 * Keeps `message` as the custom validity of `input` while it is non-empty: how a field that is partly filled in
 * becomes invalid, since a script-set empty value carries no native flag for it. Field's own `validate` message
 * replaces it while it shows; it is installed again when the message changes.
 */
export function createIncompleteValidity(
  input: Accessor<HTMLInputElement | undefined>,
  message: Accessor<string>,
): void {
  createEffect(
    () => [input(), message()] as const,
    ([element, text]) => {
      if (!element || text === "") return;
      element.setCustomValidity(text);
      return () => {
        if (element.validationMessage === text) element.setCustomValidity("");
      };
    },
  );
}
