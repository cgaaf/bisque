/// <reference lib="esnext.temporal" />
// (The reference is for oxlint's type-aware rules; see ./date.ts.)
// What the calendar family (`src/calendar/calendar.rx`) needs beyond the date core (./date.ts): the visible
// months as a list, the day that is the grid's Tab stop across several months, which page shows a day, the
// writing direction, and moving focus to a day once the grid has rendered it. `../calendar.d.rx` declares how
// `.rx` may call it, through the `../calendar.js` facade.
import { createEffect, type Accessor } from "solid-js";
import {
  compareMonths,
  defaultFocusDate,
  formatMonth,
  isDateInRange,
  type DateConstraints,
  type Locale,
} from "./date.ts";

type PlainDate = Temporal.PlainDate;
type PlainYearMonth = Temporal.PlainYearMonth;

/** One visible month of a calendar: `offset` is its place from the first (0), `key` its ISO string. */
export type CalendarMonth = { value: PlainYearMonth; key: string; offset: number; label: string };

/** The `count` months from `first` on (at least one), labelled in `locale`. */
export function visibleMonths(first: PlainYearMonth, count: number, locale: Locale): CalendarMonth[] {
  return Array.from({ length: Math.max(1, Math.floor(count)) }, (_, offset) => {
    const value = first.add({ months: offset });
    return { value, key: value.toString(), offset, label: formatMonth(value, locale) };
  });
}

/** Whether `date` falls in one of the `count` months from `first`. */
export function isVisible(date: PlainDate | undefined, first: PlainYearMonth, count: number): boolean {
  if (date === undefined) return false;
  const last = first.add({ months: Math.max(1, Math.floor(count)) - 1 });
  return compareMonths(date, first) >= 0 && compareMonths(date, last) <= 0;
}

/**
 * The first month of the page that shows `date`, paging from `first` by `count` months at a time: `first` itself
 * when `date` is already visible. Moving focus past the visible months turns whole pages, as the Previous and
 * Next buttons do, so the months on screen are always ones those buttons would show.
 */
export function pageFor(date: PlainDate, first: PlainYearMonth, count: number): PlainYearMonth {
  const size = Math.max(1, Math.floor(count));
  const month = date.toPlainYearMonth();
  const apart = (month.year - first.year) * month.monthsInYear + (month.month - first.month);
  const pages = Math.floor(apart / size);
  return pages === 0 ? first : first.add({ months: pages * size });
}

/**
 * The day that is the grid's one Tab stop: `focused` (the day focus was last on) if it is visible and within
 * `[min, max]`; else, in the first visible month that holds one, the selected day, then today; else the first
 * available day of the first visible month (defaultFocusDate's order, across several months).
 */
export function tabStopDate(
  first: PlainYearMonth,
  count: number,
  focused: PlainDate | undefined,
  selected: PlainDate | undefined,
  todayDate: PlainDate | undefined,
  constraints: DateConstraints | undefined,
): PlainDate {
  if (focused !== undefined && isVisible(focused, first, count)) {
    if (isDateInRange(focused, constraints?.min, constraints?.max)) return focused;
  }
  for (const candidate of [selected, todayDate]) {
    if (candidate !== undefined && isVisible(candidate, first, count)) {
      return defaultFocusDate(candidate.toPlainYearMonth(), candidate, undefined, constraints);
    }
  }
  return defaultFocusDate(first, undefined, undefined, constraints);
}

/** Whether `element` is laid out right to left (its computed `direction`, from any `dir` above it). */
export function isRtl(element: Element | null | undefined): boolean {
  if (!element) return false;
  return getComputedStyle(element).direction === "rtl";
}

/** A request to focus a day: `key` is the day's ISO string; each new request has a larger `count`. */
export type DayFocusRequest = { key: string; count: number };

/**
 * Focuses the day button `request.key` names inside `root` (`[data-date]`, never a day outside its month, which
 * repeats a day of the next or previous grid) whenever `request.count` grows. The button may not exist yet when
 * the request is written (moving past the visible month renders a new grid), and the root may be in a popover
 * that is about to be shown, so it is looked for after this flush and, failing that, on the next two frames.
 */
export function createDayFocus(
  root: Accessor<HTMLElement | undefined>,
  request: Accessor<DayFocusRequest>,
): void {
  let handled = 0;
  createEffect(
    () => {
      // One string, so a request read again with the same content compares equal.
      const next = request();
      return `${next.count} ${next.key}`;
    },
    (value) => {
      const space = value.indexOf(" ");
      const count = Number(value.slice(0, space));
      const key = value.slice(space + 1);
      if (count <= handled) return;
      handled = count;
      let cancelled = false;
      let frame = 0;
      const attempt = (tries: number) => {
        if (cancelled) return;
        const container = root();
        const button = container?.querySelector<HTMLElement>(
          `[data-date="${CSS.escape(key)}"]:not([data-outside-month])`,
        );
        if (button && button.isConnected) {
          button.focus();
          if (button.ownerDocument.activeElement === button) return;
        }
        if (tries > 0 && typeof requestAnimationFrame === "function") {
          frame = requestAnimationFrame(() => attempt(tries - 1));
        }
      };
      queueMicrotask(() => attempt(2));
      return () => {
        cancelled = true;
        if (frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      };
    },
  );
}
