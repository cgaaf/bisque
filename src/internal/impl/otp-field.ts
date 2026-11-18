// The OTP field's text rules and the DOM work its slots need. `../otp-field.d.rx` declares how `.rx` may call it.
//
// The value rules (whitespace stripped, characters outside the validation type rejected, a consumer's
// normalisation, clamped to the slot count) are ported from Base UI's `otp-field/utils/otp.ts`. Characters are
// counted by code point, so a character outside the BMP is one slot, not two.
import { createEffect, createSignal, untrack, type Accessor } from "solid-js";

export type OTPValidationType = "numeric" | "alpha" | "alphanumeric" | "none";
export type OTPEntryReason = "input-change" | "input-paste";

type ValidationConfig = {
  slot: string;
  root: (length: number) => string;
  reject: RegExp;
  inputMode: "numeric" | "text";
};

const CONFIG: Record<Exclude<OTPValidationType, "none">, ValidationConfig> = {
  numeric: { slot: "\\d{1}", root: (length) => `\\d{${length}}`, reject: /[^\d]/g, inputMode: "numeric" },
  alpha: {
    slot: "[a-zA-Z]{1}",
    root: (length) => `[a-zA-Z]{${length}}`,
    reject: /[^a-zA-Z]/g,
    inputMode: "text",
  },
  alphanumeric: {
    slot: "[a-zA-Z0-9]{1}",
    root: (length) => `[a-zA-Z0-9]{${length}}`,
    reject: /[^a-zA-Z0-9]/g,
    inputMode: "text",
  },
};

const configOf = (type: OTPValidationType): ValidationConfig | undefined =>
  type === "none" ? undefined : CONFIG[type];

/** The `pattern` of one slot: one character of the validation type. None for `"none"`. */
export function otpSlotPattern(type: OTPValidationType): string | undefined {
  return configOf(type)?.slot;
}

/** The `pattern` of the hidden input that holds the whole code: `length` characters of the validation type. */
export function otpRootPattern(type: OTPValidationType, length: number): string | undefined {
  return configOf(type)?.root(length);
}

/** The virtual keyboard the validation type calls for: `numeric` for digits, `text` otherwise. */
export function otpInputMode(type: OTPValidationType): "numeric" | "text" | undefined {
  return configOf(type)?.inputMode;
}

const filter = (value: string, config: ValidationConfig | undefined) =>
  config ? value.replace(config.reject, "") : value;

/**
 * `value` as the field holds it, and whether anything typed or pasted was dropped on the way: whitespace is
 * stripped, characters outside the validation type removed, `normalize` applied (then filtered again), and the
 * result cut to `length` characters.
 */
export function normalizeOtpValueWithDetails(
  value: string | null | undefined,
  length: number,
  type: OTPValidationType,
  normalize: ((value: string) => string) | undefined,
): { value: string; rejected: boolean } {
  const stripped = (value ?? "").replace(/\s/g, "");
  const config = configOf(type);
  let normalized = filter(stripped, config);
  let rejected = stripped.length > normalized.length;
  if (normalize) {
    const custom = normalize(normalized);
    rejected ||= normalized.length > custom.length;
    normalized = filter(custom, config);
    rejected ||= custom.length > normalized.length;
  }
  const characters = Array.from(normalized);
  const max = length < 0 ? 0 : length;
  return { value: characters.slice(0, max).join(""), rejected: rejected || characters.length > max };
}

export function normalizeOtpValue(
  value: string | null | undefined,
  length: number,
  type: OTPValidationType,
  normalize: ((value: string) => string) | undefined,
): string {
  return normalizeOtpValueWithDetails(value, length, type, normalize).value;
}

/** Writes `next` over the characters from slot `index` on, keeping the rest, and normalises the result. */
export function replaceOtpValue(
  current: string,
  index: number,
  next: string,
  length: number,
  type: OTPValidationType,
  normalize: ((value: string) => string) | undefined,
): string {
  const inserted = Array.from(normalizeOtpValue(next, length, type, normalize));
  const characters = Array.from(current);
  const prefix = characters.slice(0, index).join("");
  const suffix = characters.slice(index + inserted.length).join("");
  return normalizeOtpValue(`${prefix}${inserted.join("")}${suffix}`, length, type, normalize);
}

/** `current` without the character in slot `index`; the characters after it move down one slot. */
export function removeOtpCharacter(current: string, index: number): string {
  const characters = Array.from(current);
  if (index < 0 || index >= characters.length) return current;
  characters.splice(index, 1);
  return characters.join("");
}

/** How many slots `value` fills. */
export function otpLength(value: string): number {
  return Array.from(value).length;
}

/** The character in slot `index`, or "" for an empty slot (or a slot not placed yet, index -1). */
export function otpCharAt(value: string, index: number): string {
  return index < 0 ? "" : (Array.from(value)[index] ?? "");
}

const SLOT = "input[data-bisque-otp-slot]";

/**
 * The slots inside `root`, in document order: a slot's index is its place in this list, so slots may sit in groups
 * with separators between them. Read from the DOM, from a MutationObserver, and first in a microtask, outside the
 * flush that rendered them, so nothing reads a half-registered list.
 */
export function createSlotOrder(root: Accessor<HTMLElement | undefined>): Accessor<HTMLInputElement[]> {
  const [slots, setSlots] = createSignal<HTMLInputElement[]>([], {
    equals: (a, b) => a.length === b.length && a.every((slot, index) => slot === b[index]),
  });
  createEffect(
    () => root(),
    (el) => {
      if (!el) return;
      let live = true;
      const read = () => {
        if (live) setSlots([...el.querySelectorAll<HTMLInputElement>(SLOT)]);
      };
      queueMicrotask(read);
      const observer = new MutationObserver(read);
      observer.observe(el, { childList: true, subtree: true });
      return () => {
        live = false;
        observer.disconnect();
      };
    },
  );
  return slots;
}

/** Where `element` is among `slots`, or -1 before the slot list has found it. */
export function slotIndex(slots: HTMLInputElement[], element: HTMLInputElement | undefined): number {
  return element ? slots.indexOf(element) : -1;
}

/**
 * Keeps the text of `input` equal to `text`, writing it only when `text` (or `revision`) changes and differs from
 * what the input shows. A `value` in the slot's props would be written again whenever they recompute; `revision`
 * re-applies the text after a form reset, which changes the inputs without telling the field.
 */
export function createSlotText(
  input: Accessor<HTMLInputElement | undefined>,
  text: Accessor<string>,
  revision: Accessor<number>,
): void {
  // The compute reads `revision` and returns the text, so a reset re-applies an unchanged text.
  createEffect(
    () => {
      revision();
      return input() ? text() : undefined;
    },
    (value) => {
      const el = untrack(input);
      if (el && value !== undefined && el.value !== value) el.value = value;
    },
  );
}

/** Puts `text` back in a slot (the browser has already changed it), and selects it when `select`. */
export function restoreSlot(input: HTMLInputElement, text: string, select: boolean): void {
  if (input.value !== text) input.value = text;
  if (select) input.select();
}

/** Selects a slot's text, so the next key replaces it. */
export function selectSlot(input: HTMLInputElement): void {
  input.select();
}

/** Focuses slot `index` (clamped to the slots there are) and selects its text. */
export function focusSlot(slots: HTMLInputElement[], index: number): void {
  if (slots.length === 0) return;
  const target = slots[Math.max(0, Math.min(index, slots.length - 1))];
  target.focus();
  target.select();
}

/** Whether the slot's whole text is selected. */
export function isFullySelected(input: HTMLInputElement): boolean {
  return input.selectionStart === 0 && input.selectionEnd === input.value.length;
}

/** Whether `node` is `root` or inside it. */
export function containsNode(root: HTMLElement | undefined, node: Node | null): boolean {
  return !!root && !!node && root.contains(node);
}

/** The plain text a paste carries, or null when the clipboard can't be read. */
export function clipboardText(event: ClipboardEvent): string | null {
  try {
    return event.clipboardData?.getData("text/plain") ?? "";
  } catch {
    return null;
  }
}

/** Some Android keyboards report all typing as one long composition, so there it is taken as it comes. */
export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

export type Composition = {
  /** On `compositionstart`: the slot's text is the IME's until the composition ends (not on Android). */
  start: () => void;
  /** On `compositionend`: whether a composition was in progress, which then ends. */
  end: () => boolean;
  /** Whether a composition is in progress. */
  active: () => boolean;
};

/**
 * Whether an IME composition is in progress in a slot. Plain state, not a signal: the composition's events can
 * arrive with no flush between them (Playwright's fill in Firefox sends `compositionstart` and `compositionend`
 * back to back), and each must see what the one before it did.
 */
export function createComposition(): Composition {
  let composing = false;
  return {
    start: () => {
      if (!isAndroid()) composing = true;
    },
    end: () => {
      const was = composing;
      composing = false;
      return was;
    },
    active: () => composing,
  };
}

/** Whether the slot is laid out right to left (the CSS `direction`, which `dir` sets), so the arrow keys swap. */
export function isRtl(element: HTMLElement): boolean {
  return getComputedStyle(element).direction === "rtl";
}

/**
 * Submits the form the code belongs to, as pressing its submit button would (`requestSubmit`, so validation and
 * `submit` handlers run): the form named by `formId`, else the hidden input's, else the first slot's.
 */
export function submitOwnForm(
  hidden: HTMLInputElement | undefined,
  slots: HTMLInputElement[],
  formId: string | undefined,
): void {
  let form = hidden?.form ?? slots[0]?.form ?? null;
  const doc = (hidden ?? slots[0])?.ownerDocument;
  if (formId && doc) {
    const named = doc.getElementById(formId);
    if (named instanceof HTMLFormElement) form = named;
  }
  if (form && typeof form.requestSubmit === "function") form.requestSubmit();
}

export type OTPCompletion = {
  /** The consumer's `onValueComplete`. */
  onComplete: ((value: string, details: { reason: OTPEntryReason }) => void) | undefined;
  /** Submit the form once complete. */
  autoSubmit: boolean;
  hidden: HTMLInputElement | undefined;
  /** The `form` attribute's id. */
  form: string | undefined;
};

export type OTPWatch = {
  /** Focus slot `index` once the value is `value`; forgotten if the value becomes anything else. */
  queueFocus: (index: number, value: string) => void;
  /** Report completion once the value is `value`; forgotten if the value becomes anything else. */
  queueComplete: (value: string, reason: OTPEntryReason) => void;
  clearComplete: () => void;
  /** Report completion now: a whole code pasted over an equal one, which changes nothing. */
  completeNow: (value: string, reason: OTPEntryReason) => void;
};

/**
 * What follows a change of the value, once it has reached the slots: focus moves to the slot the edit asked for, and
 * completion is reported (`onComplete`, then the form submitted with `autoSubmit`). Both are asked for when the
 * change is made and done only if the value really became what was asked (an owner of a controlled value may take
 * it later, or never). A value that shrinks under a focused slot (an owner clearing it) moves focus back to the first
 * empty slot, so typing and Backspace keep working.
 *
 * Done in a microtask after the change's flush, when every slot and the hidden input show the new value: selecting a
 * slot before its text is written would leave the caret, not a selection, and a submit would send the old code.
 * The consumer's handler is called from here, outside any change of the field's, as an event handler would be.
 */
export function createOTPWatch(
  value: Accessor<string>,
  slots: Accessor<HTMLInputElement[]>,
  completion: Accessor<OTPCompletion>,
): OTPWatch {
  let focus: { index: number; value: string } | undefined;
  let complete: { value: string; reason: OTPEntryReason } | undefined;
  let first = true;
  const report = (current: string, reason: OTPEntryReason) => {
    const { onComplete, autoSubmit, hidden, form } = untrack(completion);
    onComplete?.(current, { reason });
    if (autoSubmit) submitOwnForm(hidden, untrack(slots), form);
  };
  createEffect(
    () => value(),
    (current) => {
      if (first) {
        first = false;
        return;
      }
      const wantedFocus = focus;
      const wantedComplete = complete;
      focus = undefined;
      complete = undefined;
      queueMicrotask(() => {
        const list = untrack(slots);
        if (wantedFocus && wantedFocus.value === current) {
          focusSlot(list, wantedFocus.index);
        } else {
          const active = list.findIndex((slot) => slot.ownerDocument.activeElement === slot);
          const filled = otpLength(current);
          if (active > filled) focusSlot(list, filled);
        }
        if (wantedComplete && wantedComplete.value === current) report(current, wantedComplete.reason);
      });
    },
  );
  return {
    queueFocus: (index, next) => {
      focus = { index, value: next };
    },
    queueComplete: (next, reason) => {
      complete = { value: next, reason };
    },
    clearComplete: () => {
      complete = undefined;
    },
    completeNow: (next, reason) => {
      queueMicrotask(() => report(next, reason));
    },
  };
}

/**
 * The id of the native `<label>` of the first slot (a wrapping label, or one whose `for` names it), giving the
 * label `id` if it has none, so the other slots can be labelled by it too. Undefined while `enabled` is false (the
 * group already has a label) or the slot has no label. Read in a microtask, after the slots are in the document.
 */
export function createLabelFallback(
  slot: Accessor<HTMLInputElement | undefined>,
  enabled: Accessor<boolean>,
  id: string,
): Accessor<string | undefined> {
  const [labelId, setLabelId] = createSignal<string | undefined>(undefined);
  createEffect(
    () => (enabled() ? slot() : undefined),
    (el) => {
      let live = true;
      queueMicrotask(() => {
        if (!live) return;
        const label = el ? (el.labels?.[0] ?? null) : null;
        if (label && !label.id) label.id = id;
        setLabelId(label ? label.id : undefined);
      });
      return () => {
        live = false;
      };
    },
  );
  return labelId;
}

/** The ids in `a` and `b`, once each, space-separated; undefined when there are none. */
export function joinIds(a: string | undefined, b: string | undefined): string | undefined {
  const ids = [...new Set(`${a ?? ""} ${b ?? ""}`.split(/\s+/).filter(Boolean))];
  return ids.length > 0 ? ids.join(" ") : undefined;
}
