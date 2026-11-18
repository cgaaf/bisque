/// <reference lib="esnext.temporal" />
// What the Time Picker and Time Range Picker need that `.rx` can't write (src/time-picker, src/time-range-picker):
// the options of each column with the ones outside [min, max] disabled, the time a choice in a column makes, the
// option a column opens on, the interval list of whole times, and the DOM work of opening (scroll every column to
// its option, focus the first) and of moving between columns. Formatting and the hour cycle come from ./date.ts.
import {
  clampTime,
  compareTimes,
  dayPeriodOptions,
  formatTime,
  hourCycleOf,
  hourOptions,
  minuteOptions,
  secondOptions,
  timeToString,
  withDayPeriod,
  type Locale,
  type TimeGranularity,
} from "./date.ts";
import { createEffect, type Accessor } from "solid-js";
import { listItems } from "./roving.ts";

type PlainTime = Temporal.PlainTime;
type MaybeElement = HTMLElement | undefined;

/** A column of the picker's popup. */
export type TimeUnit = "hour" | "minute" | "second" | "dayPeriod";

/** One option of a column or of the interval list: its value as a listbox holds it, its text, and whether it can be chosen. */
export type TimePickerOption = { value: string; label: string; disabled: boolean };

export type ColumnSettings = {
  locale: Locale;
  hourCycle: 12 | 24 | undefined;
  /** Minutes or seconds between options (minute and second columns). Default: 1. */
  step: number | undefined;
  min: PlainTime | undefined;
  max: PlainTime | undefined;
};

// Made when used, not at import: an app may install a Temporal polyfill after importing the library.
const at = (hour: number, minute = 0) => new Temporal.PlainTime(hour, minute);
const endOfHour = (hour: number) => new Temporal.PlainTime(hour, 59, 59, 999, 999, 999);

/** Whether no time of `[low, high]` is within `[min, max]` (an undefined bound is open). */
function outside(
  low: PlainTime,
  high: PlainTime,
  min: PlainTime | undefined,
  max: PlainTime | undefined,
): boolean {
  return (
    (min !== undefined && compareTimes(high, min) < 0) || (max !== undefined && compareTimes(low, max) > 0)
  );
}

/** The latest time that starts with `time`'s units down to `unit`: 09:30 to the minute is 09:30:59.999999999. */
function endOf(time: PlainTime, unit: TimeUnit): PlainTime {
  const rest = { millisecond: 999, microsecond: 999, nanosecond: 999 };
  if (unit === "hour") return time.with({ minute: 59, second: 59, ...rest });
  if (unit === "minute") return time.with({ second: 59, ...rest });
  return time.with(rest);
}

function startOf(time: PlainTime, unit: TimeUnit): PlainTime {
  const rest = { millisecond: 0, microsecond: 0, nanosecond: 0 };
  if (unit === "hour") return time.with({ minute: 0, second: 0, ...rest });
  if (unit === "minute") return time.with({ second: 0, ...rest });
  return time.with(rest);
}

/** `time` with its units finer than `granularity` set to 0. */
function truncate(time: PlainTime, granularity: TimeGranularity | undefined): PlainTime {
  return time.round({ smallestUnit: granularity ?? "minute", roundingMode: "trunc" });
}

/**
 * The time a picker with no value opens on: now, down to `granularity`, its minutes and seconds rounded to the nearest
 * step (as `columnTarget` rounds), so that a first choice in one column doesn't keep a minute the list doesn't have.
 */
export function openingTime(
  granularity: TimeGranularity | undefined,
  minuteStep: number | undefined,
  secondStep: number | undefined,
): PlainTime {
  const time = truncate(Temporal.Now.plainTimeISO(), granularity);
  return time.with({
    minute: nearestStep(time.minute, minuteStep),
    second: nearestStep(time.second, secondStep),
  });
}

/** Whether the locale (or the override) counts hours 1–12 with a day period. */
export function isTwelveHour(locale: Locale, hourCycle: 12 | 24 | undefined): boolean {
  return hourCycleOf(locale, hourCycle) !== "h23";
}

/**
 * The options of one column, for a picker whose time is `basis` (its value, or what it opens on). The hour column of
 * a 12-hour locale lists the hours of `basis`'s day period. An option is disabled when no time it can make is within
 * `[min, max]`: an hour when the whole hour is outside, a minute when the whole minute of `basis`'s hour is.
 */
export function columnOptions(
  unit: TimeUnit,
  basis: PlainTime,
  settings: ColumnSettings,
): TimePickerOption[] {
  const { locale, hourCycle, step, min, max } = settings;
  if (unit === "dayPeriod") {
    return dayPeriodOptions(locale).map((option) => {
      const low = at(option.value === 1 ? 12 : 0);
      const high = endOfHour(option.value === 1 ? 23 : 11);
      return { value: String(option.value), label: option.label, disabled: outside(low, high, min, max) };
    });
  }
  const list =
    unit === "hour"
      ? hourOptions(
          locale,
          hourCycle,
          isTwelveHour(locale, hourCycle) ? (basis.hour >= 12 ? 1 : 0) : undefined,
        )
      : unit === "minute"
        ? minuteOptions(locale, step)
        : secondOptions(locale, step);
  return list.map((option) => {
    const time = startOf(basis.with({ [unit]: option.value }), unit);
    return {
      value: String(option.value),
      label: option.label,
      disabled: outside(time, endOf(time, unit), min, max),
    };
  });
}

/** The value `time` selects in a column: its hour (0–23), minute, second, or day period ("0" AM, "1" PM). */
export function columnValue(time: PlainTime, unit: TimeUnit): string {
  if (unit === "dayPeriod") return time.hour >= 12 ? "1" : "0";
  return String(time[unit]);
}

/** The option nearest `n` among 0, step, 2·step … below 60. */
function nearestStep(n: number, step: number | undefined): number {
  const every = step !== undefined && step >= 1 ? Math.floor(step) : 1;
  const last = Math.floor(59 / every) * every;
  return Math.min(Math.round(n / every) * every, last);
}

/**
 * The option a column opens on when nothing in it is selected: `basis`'s, rounded to the nearest step for minutes
 * and seconds (a time typed off the step, 09:07 with a step of 15, opens the minutes on 00).
 */
export function columnTarget(basis: PlainTime, unit: TimeUnit, step: number | undefined): string {
  if (unit === "minute" || unit === "second") return String(nearestStep(basis[unit], step));
  return columnValue(basis, unit);
}

/**
 * The time a choice in a column makes from `basis`: that unit replaced (the day period keeps the hour on the clock
 * face), units finer than `granularity` set to 0, and the result clamped into `[min, max]` so that choosing an hour
 * never lands on a minute that hour doesn't allow. Undefined for a value that isn't a number.
 */
export function chooseInColumn(
  basis: PlainTime,
  unit: TimeUnit,
  value: string,
  granularity: TimeGranularity | undefined,
  min: PlainTime | undefined,
  max: PlainTime | undefined,
): PlainTime | undefined {
  const n = Number(value);
  if (value === "" || !Number.isInteger(n)) return undefined;
  const next = unit === "dayPeriod" ? withDayPeriod(basis, n) : basis.with({ [unit]: n });
  return next === undefined ? undefined : clampTime(truncate(next, granularity), min, max);
}

/**
 * Whole times every `interval` minutes from midnight (00:00, 00:30 … 23:30), for a one-list picker. The value is the
 * time as a form submits it down to `granularity`, the label the locale's; one outside `[min, max]` is disabled.
 */
export function intervalOptions(
  locale: Locale,
  interval: number | undefined,
  granularity: TimeGranularity | undefined,
  hourCycle: 12 | 24 | undefined,
  min: PlainTime | undefined,
  max: PlainTime | undefined,
): TimePickerOption[] {
  const given = interval !== undefined && interval >= 1 ? Math.floor(interval) : 30;
  // Whole hours only at hour granularity: 09:30 would submit as 09:00, the same value as 09:00.
  const every = granularity === "hour" ? Math.max(60, Math.ceil(given / 60) * 60) : given;
  const unit = granularity === "hour" ? "minute" : granularity;
  const count = Math.ceil(1440 / every);
  return Array.from({ length: count }, (_, index) => {
    const minutes = index * every;
    const time = at(Math.floor(minutes / 60), minutes % 60);
    return {
      value: timeToString(time, granularity),
      label: formatTime(time, locale, unit, hourCycle),
      disabled: outside(time, time, min, max),
    };
  });
}

/** The interval option nearest `basis` (rounding down from 23:45 at 30 minutes, which has no next option today). */
export function intervalTarget(
  basis: PlainTime,
  interval: number | undefined,
  granularity: TimeGranularity | undefined,
): string {
  const given = interval !== undefined && interval >= 1 ? Math.floor(interval) : 30;
  const every = granularity === "hour" ? Math.max(60, Math.ceil(given / 60) * 60) : given;
  const minutes = basis.hour * 60 + basis.minute + basis.second / 60;
  const last = Math.floor(1439 / every) * every;
  const nearest = Math.min(Math.round(minutes / every) * every, last);
  return timeToString(at(Math.floor(nearest / 60), nearest % 60), granularity);
}

// ---- The DOM: opening and moving between columns ----

const COLUMN = "[data-bisque-time-column]";

function enabledItems(list: HTMLElement): HTMLElement[] {
  return listItems(list).filter((item) => !item.hasAttribute("data-disabled"));
}

/** The option a column opens on: the selected one, else the one its `data-target` names, else the first enabled. */
function openingItem(list: HTMLElement): HTMLElement | undefined {
  const items = enabledItems(list);
  return (
    items.find((item) => item.hasAttribute("data-bisque-current")) ??
    items.find((item) => item.getAttribute("data-value") === list.getAttribute("data-target")) ??
    items[0]
  );
}

/** Scrolls `list` so that `item` is in the middle of it, without scrolling anything else. */
function centre(list: HTMLElement, item: HTMLElement): void {
  const listBox = list.getBoundingClientRect();
  const itemBox = item.getBoundingClientRect();
  list.scrollTop += itemBox.top - listBox.top - (list.clientHeight - itemBox.height) / 2;
}

function makeTabStop(list: HTMLElement, stop: HTMLElement): void {
  for (const item of listItems(list)) item.setAttribute("tabindex", item === stop ? "0" : "-1");
}

/**
 * Once the popup's columns show what they open on (in the next frame, after the change that opened it has been
 * applied): makes each column's opening option its Tab stop, scrolls it to the middle of the column, and focuses the
 * first column's, unless focus is in the popup already. Focus is moved with `preventScroll`, so the page doesn't jump.
 */
export function focusColumns(popup: MaybeElement): void {
  if (!popup) return;
  requestAnimationFrame(() => {
    if (!popup.matches(":popover-open")) return;
    let first: HTMLElement | undefined;
    for (const list of popup.querySelectorAll<HTMLElement>(COLUMN)) {
      const item = openingItem(list);
      if (!item) continue;
      makeTabStop(list, item);
      centre(list, item);
      first ??= item;
    }
    // Focus already inside (an option pressed before this frame) stays where it is.
    if (!popup.contains(popup.ownerDocument.activeElement)) (first ?? popup).focus({ preventScroll: true });
  });
}

/**
 * Moves focus from the column holding `from` to the column on its right (`direction` 1) or its left (-1) on screen,
 * in the same popup, onto that column's Tab stop: in a right-to-left popup (its computed `direction`) the next
 * column in the document is the one on the left. Returns false, moving nothing, when there is no column that way.
 */
export function focusAdjacentColumn(from: EventTarget | null, direction: number): boolean {
  if (!(from instanceof HTMLElement)) return false;
  const list = from.closest<HTMLElement>(COLUMN);
  const popup = list?.parentElement?.closest<HTMLElement>("[popover]");
  if (!list || !popup) return false;
  const lists = Array.from(popup.querySelectorAll<HTMLElement>(COLUMN));
  // `direction` is on screen (ArrowRight is 1); in a right-to-left popup the columns run from the right.
  const rtl = getComputedStyle(popup).direction === "rtl";
  const next = lists[lists.indexOf(list) + (rtl ? -direction : direction)];
  if (!next) return false;
  const items = enabledItems(next);
  const target = items.find((item) => item.getAttribute("tabindex") === "0") ?? openingItem(next);
  target?.focus();
  return target !== undefined;
}

/**
 * Whether `next` (a focus event's `relatedTarget`) is outside both `popup` and `trigger`: focus has left the picker's
 * popup for somewhere else (Tab past the last column, a click elsewhere), not for its own trigger.
 */
export function focusLeft(popup: MaybeElement, trigger: MaybeElement, next: EventTarget | null): boolean {
  return (
    popup !== undefined &&
    next instanceof Node &&
    !popup.contains(next) &&
    !(trigger?.contains(next) ?? false)
  );
}

/** The value of the enabled option an event happened on (a click on its text included), or undefined. */
export function chosenOption(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) return undefined;
  const item = target.closest<HTMLElement>("[data-bisque-item]");
  if (!item || item.hasAttribute("data-disabled")) return undefined;
  return item.getAttribute("data-value") ?? undefined;
}

/**
 * Calls `onReset` once the form `element` belongs to (or the one `formId` names) has been reset (not for a cancelled reset), after every control
 * inside has handled the reset itself. A picker's fields are controlled by the picker; each puts the picker's value
 * back into its hidden input on reset (`createFormReset`, ./field.ts, a task after the event), and only then may the
 * picker change that value to its default. Changed earlier, a field's `min`, `max` or `value` binding re-ran over an
 * input the browser had just emptied.
 */
export function createLateFormReset(
  element: Accessor<Element | undefined>,
  formId: Accessor<string | undefined>,
  onReset: () => void,
): void {
  createEffect(
    () => [element(), formId()] as const,
    ([target, id]) => {
      // The form named by the picker's `form` prop, else the one around it.
      const named = id && target ? target.ownerDocument.getElementById(id) : null;
      const form = named instanceof HTMLFormElement ? named : target?.closest("form");
      if (!form) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const reset = (event: Event) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          timer = setTimeout(() => {
            if (!event.defaultPrevented) onReset();
          }, 0);
        }, 0);
      };
      form.addEventListener("reset", reset);
      return () => {
        clearTimeout(timer);
        form.removeEventListener("reset", reset);
      };
    },
  );
}

/**
 * The validity of a time range's two hidden inputs (src/time-range-picker). Each gets its own message as its custom
 * validity (incomplete, or a start after the end); then the start input, the one a FieldRoot reads, also takes the
 * end's problem (its message, or a native one such as `rangeOverflow`), so the Field is invalid when either side is.
 * `key` changes whenever the inputs' values or constraints do, so the end's native validity is read again.
 */
export function createTimeRangeValidity(
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

const rangeValues = new Map<string, { start: string; end: string }>();

/**
 * A time range's Field value, `{ start, end }` form strings, or null while either is empty. The same object for the
 * same strings: Field compares a value with the one it started from by identity, so a range put back by a form reset
 * must be the very object the reset gave it, or the Field stays dirty.
 */
export function rangeFieldValue(start: string, end: string): { start: string; end: string } | null {
  if (start === "" || end === "") return null;
  const key = `${start}/${end}`;
  let found = rangeValues.get(key);
  if (!found) {
    if (rangeValues.size > 64) rangeValues.clear();
    found = { start, end };
    rangeValues.set(key, found);
  }
  return found;
}
