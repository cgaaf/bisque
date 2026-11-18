// What the Date Picker and Date Range Picker need that .rx can't write: `../date-picker.d.rx` declares how `.rx` may
// call it.
import { createEffect, untrack, type Accessor } from "solid-js";
import { mergeProps } from "./props.ts";
import type { PartProps } from "./types.ts";

/**
 * `mergeProps(internal, external)` without reading `external.children`. A part that renders a providing part of
 * another family (Date Field's root) with the consumer's children must not read them before that part's
 * provision exists: reading `children` builds them, and they would find no context. Every other attribute merges
 * as `mergeProps` does (handlers and refs both run, classes join, styles merge, otherwise the consumer wins).
 */
export function mergeOuterProps(internal: object, external: object | undefined): PartProps {
  if (!external) return mergeProps(internal, undefined);
  const given = external as Record<string, unknown>;
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(given)) if (key !== "children") copy[key] = given[key];
  return mergeProps(internal, copy);
}

/**
 * The validity of a range's two hidden inputs, for a Field (which reads one input, the start) and for the browser.
 * The end input gets `endMessage` as its custom validity; the start input gets `startMessage`, else the end input's
 * own message when the end is invalid (natively too: `rangeOverflow` beyond `max`), so a Field around the range
 * sees either side's problem. `key` is anything that changes when the inputs' values or constraints do: it re-runs
 * the check after they are written.
 */
export function createRangeValidity(
  start: Accessor<HTMLInputElement | undefined>,
  end: Accessor<HTMLInputElement | undefined>,
  startMessage: Accessor<string>,
  endMessage: Accessor<string>,
  key: Accessor<string>,
): void {
  createEffect(
    () => [start(), end(), startMessage(), endMessage(), key()] as const,
    ([startInput, endInput, startText, endText]) => {
      if (endInput) endInput.setCustomValidity(endText);
      if (!startInput) return;
      const endProblem = endInput && !endInput.validity.valid ? endInput.validationMessage : "";
      startInput.setCustomValidity(startText || endProblem);
    },
  );
}

/**
 * Puts focus back on `trigger` when the popup closes with focus still inside it. An engine restores focus itself
 * when a popover that had focus is hidden, to the element that had focus when it was shown; WebKit doesn't focus a
 * button that is pressed, so after a press opened the popup that element is the body, and focus is left on the
 * hidden popup (Escape, then nothing focused). A close that already moved focus elsewhere (a press outside on a
 * focusable element, or the engine's own restore) is left alone.
 */
export function createFocusReturn(
  popup: Accessor<HTMLElement | undefined>,
  trigger: Accessor<HTMLElement | undefined>,
  open: Accessor<boolean>,
): void {
  createEffect(
    () => open(),
    (isOpen) => {
      if (isOpen) return;
      const element = untrack(popup);
      const target = untrack(trigger);
      if (!element || !target) return;
      const active = element.ownerDocument.activeElement;
      if (active && element.contains(active)) target.focus();
    },
  );
}

/**
 * Runs `run` in a task of its own, after the tasks already queued. A picker's form reset uses it to apply its value
 * after the field's and the calendar's own reset handlers (each a task queued by the same `reset` event) have
 * written their hidden inputs back: applied before them, the calendar re-applies an unchanged value over the
 * input the browser had just emptied (UNCOMMITTED_INPUT_OVERWRITTEN).
 */
export function afterOtherResets(run: () => void): void {
  setTimeout(run, 0);
}
