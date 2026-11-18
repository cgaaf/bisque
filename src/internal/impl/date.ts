/// <reference lib="esnext.temporal" />
// (The reference is for oxlint's type-aware rules, which check this file outside tsconfig.ts.json and otherwise
// see no `Temporal`. tsrs and rx-tsc get it from `lib: ["ESNext"]`.)
//
// The date and time core the calendar, date field, time field and picker families share. Pure functions over
// Temporal values (`Temporal.PlainDate`, `Temporal.PlainTime`, `Temporal.PlainYearMonth`): comparing them, laying
// out a month, moving focus in a grid, range maths, the segmented-field model, form strings and time lists.
// `.rx` has no `Temporal`, `Intl` or `Math` value, so everything it needs beyond instance methods is here.
// `../date.d.rx` declares how `.rx` may call it, and says how `.rx` must hold a Temporal value.
//
// The global `Temporal` is used and never imported: the library ships no polyfill (see platform.md).
//
// Calendars: every computation reads the calendar's own fields (`daysInWeek`, `daysInMonth`, `monthsInYear`,
// `monthCode`) and moves with `.add()`, so a value in a non-ISO calendar (hebrew, persian, islamic-*) lays out and
// formats in that calendar. Labels are formatted in the value's own calendar, an ISO value as Gregorian, so a
// label always agrees with the grid it labels (an ISO date in `th-TH` shows the Gregorian year, not the Buddhist
// one: pass a `buddhist` date for that). Calendars whose numeric format carries an era or a related year
// (japanese, roc, chinese, dangi) are not supported by the segmented field.

type PlainDate = Temporal.PlainDate;
type PlainTime = Temporal.PlainTime;
type PlainYearMonth = Temporal.PlainYearMonth;

export type Locale = string | string[] | undefined;

/** An ordered, inclusive range of days: `start` is never after `end`. */
export type DateRange = { start: PlainDate; end: PlainDate };

/** What makes a day unavailable: before `min`, after `max`, or `isDisabled` says so. */
export type DateConstraints = {
  min?: PlainDate | undefined;
  max?: PlainDate | undefined;
  isDisabled?: ((date: PlainDate) => boolean) | undefined;
};

/** One cell of a month grid. `key` is the day's ISO string, stable across recomputation. */
export type CalendarDay = { date: PlainDate; key: string; outsideMonth: boolean; dayOfWeek: number };

/** One row of a month grid. `weekNumber` is the ISO week of the row's Thursday (the ISO week most of it is in). */
export type CalendarWeek = { key: string; weekNumber: number; days: CalendarDay[] };

export type MonthGridOptions = {
  locale?: Locale;
  /** 1 (Monday) to 7 (Sunday), as `dayOfWeek` and `Intl.Locale#getWeekInfo` count. Default: the locale's. */
  firstDayOfWeek?: number | undefined;
  /** Always six rows (so the grid's height doesn't change from month to month). */
  fixedWeeks?: boolean | undefined;
};

export type WeekdayName = { dayOfWeek: number; label: string; name: string };

/** An entry of a month or year select. `value` is the visible month it moves to. */
export type CalendarOption = { value: PlainYearMonth; key: string; label: string; disabled: boolean };

export type WeekInfo = { firstDay: number; weekend: number[] };

export type DateMove =
  | "next-day"
  | "previous-day"
  | "next-week"
  | "previous-week"
  | "next-month"
  | "previous-month"
  | "next-year"
  | "previous-year"
  | "start-of-week"
  | "end-of-week";

export type MoveOptions = DateConstraints & { locale?: Locale; firstDayOfWeek?: number | undefined };

export type TimeGranularity = "hour" | "minute" | "second";
export type HourCycle = "h11" | "h12" | "h23";

export type SegmentKind = "year" | "month" | "day" | "hour" | "minute" | "second" | "dayPeriod";

/**
 * What a segmented field holds while it is edited: a number or undefined per segment. `month` is the ordinal
 * month in the field's calendar; `hour` is always 0–23 (in a 12-hour field it is read with `dayPeriod`, 0 for AM
 * and 1 for PM, and an hour typed before the period is chosen counts as AM).
 */
export type SegmentValues = {
  year?: number | undefined;
  month?: number | undefined;
  day?: number | undefined;
  hour?: number | undefined;
  minute?: number | undefined;
  second?: number | undefined;
  dayPeriod?: number | undefined;
};

export type FieldOptions = {
  type: "date" | "time";
  locale?: Locale;
  /** Date fields: the calendar the segments count in. Default "iso8601". */
  calendar?: string | undefined;
  /** Time fields: the smallest segment. Default "minute". */
  granularity?: TimeGranularity | undefined;
  /** Time fields: 12 or 24 overrides the locale's hour cycle. */
  hourCycle?: 12 | 24 | undefined;
  /** What an empty segment becomes when stepped. Default: today (date fields), midnight (time fields). */
  placeholderValue?: PlainDate | PlainTime | undefined;
};

/**
 * One segment of a field, or a literal between segments. `value`, `min` and `max` are what the segment shows
 * (the hour as 1–12 in a 12-hour field), for `aria-valuenow`/`-min`/`-max`. `text` is the value as shown, or
 * `placeholder` while empty. `valueText` is for `aria-valuetext`; undefined while empty (supply "Empty" in the
 * app's language). `label` is the segment's name in the locale ("year", "Jahr") for `aria-label`.
 */
export type FieldSegment = {
  kind: SegmentKind | "literal";
  text: string;
  value: number | undefined;
  min: number;
  max: number;
  placeholder: string;
  editable: boolean;
  label: string;
  valueText: string | undefined;
};

/** The result of a key typed into a segment: the new values, the digits typed so far, and whether to move on. */
export type SegmentEntry = { values: SegmentValues; buffer: string; advance: boolean };

export type TimeOption = { value: number; label: string };

const ISO = "iso8601";
// How far `moveDate` looks for an available day before it gives up and stays put.
const MAX_SEARCH = 1000;
// Years looked at to find the most months in a year or days in a month while the year is still empty.
const PROBE_YEARS = 8;

// ---- Formatting ----

const dateFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function dateFormat(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify([locale, options]);
  let found = dateFormats.get(key);
  if (!found) {
    found = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, found);
  }
  return found;
}

function numberFormat(locale: Locale, numberingSystem: string, digits: number): Intl.NumberFormat {
  const key = JSON.stringify([locale, numberingSystem, digits]);
  let found = numberFormats.get(key);
  if (!found) {
    found = new Intl.NumberFormat(locale, {
      useGrouping: false,
      minimumIntegerDigits: digits,
      numberingSystem,
    });
    numberFormats.set(key, found);
  }
  return found;
}

// The formatter's calendar for a value's calendar: an ISO value is shown as Gregorian.
function displayCalendar(calendarId: string): string {
  return calendarId === ISO ? "gregory" : calendarId;
}

// Intl.DateTimeFormat takes Temporal values (natively, and once a polyfill has patched it); its TypeScript
// declaration doesn't say so yet.
function formatValue(format: Intl.DateTimeFormat, value: PlainDate | PlainTime): string {
  return format.format(value as unknown as Date);
}

function formatParts(format: Intl.DateTimeFormat, value: PlainDate | PlainTime): Intl.DateTimeFormatPart[] {
  return format.formatToParts(value as unknown as Date);
}

function formatDateWith(date: PlainDate, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return formatValue(dateFormat(locale, { ...options, calendar: displayCalendar(date.calendarId) }), date);
}

function firstDay(month: PlainYearMonth | PlainDate): PlainDate {
  return "toPlainYearMonth" in month ? month.with({ day: 1 }) : month.toPlainDate({ day: 1 });
}

// ---- Equality and order ----

/** Whether `a` and `b` are the same day, in any calendars; true when both are undefined, false when one is. */
export function isSameDay(a: PlainDate | undefined, b: PlainDate | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return Temporal.PlainDate.compare(a, b) === 0;
}

/** Whether `a` and `b` fall in the same month of `a`'s calendar; true when both are undefined, false when one is. */
export function isSameMonth(
  a: PlainDate | PlainYearMonth | undefined,
  b: PlainDate | PlainYearMonth | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  const left = firstDay(a);
  const right = ("toPlainYearMonth" in b ? b : firstDay(b)).withCalendar(left.calendarId);
  return left.year === right.year && left.monthCode === right.monthCode;
}

/** Whether `a` and `b` are the same time of day; true when both are undefined, false when one is. */
export function isSameTime(a: PlainTime | undefined, b: PlainTime | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return Temporal.PlainTime.compare(a, b) === 0;
}

/** Negative, zero or positive as `a` is before, the same day as, or after `b`; undefined sorts first. */
export function compareDates(a: PlainDate | undefined, b: PlainDate | undefined): number {
  if (a === undefined || b === undefined) return (a === undefined ? 0 : 1) - (b === undefined ? 0 : 1);
  return Temporal.PlainDate.compare(a, b);
}

/** Negative, zero or positive as `a`'s month starts before, with or after `b`'s; undefined sorts first. */
export function compareMonths(
  a: PlainDate | PlainYearMonth | undefined,
  b: PlainDate | PlainYearMonth | undefined,
): number {
  return compareDates(a && firstDay(a), b && firstDay(b));
}

/** Negative, zero or positive as `a` is earlier than, equal to or later than `b`; undefined sorts first. */
export function compareTimes(a: PlainTime | undefined, b: PlainTime | undefined): number {
  if (a === undefined || b === undefined) return (a === undefined ? 0 : 1) - (b === undefined ? 0 : 1);
  return Temporal.PlainTime.compare(a, b);
}

/** The earlier of `a` and `b`; an undefined one is ignored, undefined when both are. */
export function minDate(a: PlainDate | undefined, b: PlainDate | undefined): PlainDate | undefined {
  if (a === undefined || b === undefined) return a ?? b;
  return Temporal.PlainDate.compare(a, b) <= 0 ? a : b;
}

/** The later of `a` and `b`; an undefined one is ignored, undefined when both are. */
export function maxDate(a: PlainDate | undefined, b: PlainDate | undefined): PlainDate | undefined {
  if (a === undefined || b === undefined) return a ?? b;
  return Temporal.PlainDate.compare(a, b) >= 0 ? a : b;
}

/** `date` moved into `[min, max]` (an undefined bound is open); undefined for no date. */
export function clampDate(
  date: PlainDate | undefined,
  min: PlainDate | undefined,
  max: PlainDate | undefined,
): PlainDate | undefined {
  if (date === undefined) return undefined;
  if (min !== undefined && Temporal.PlainDate.compare(date, min) < 0) return min;
  if (max !== undefined && Temporal.PlainDate.compare(date, max) > 0) return max;
  return date;
}

/** `time` moved into `[min, max]` (an undefined bound is open); undefined for no time. */
export function clampTime(
  time: PlainTime | undefined,
  min: PlainTime | undefined,
  max: PlainTime | undefined,
): PlainTime | undefined {
  if (time === undefined) return undefined;
  if (min !== undefined && Temporal.PlainTime.compare(time, min) < 0) return min;
  if (max !== undefined && Temporal.PlainTime.compare(time, max) > 0) return max;
  return time;
}

/** Whether `date` is within `[min, max]` (an undefined bound is open); false for no date. */
export function isDateInRange(
  date: PlainDate | undefined,
  min: PlainDate | undefined,
  max: PlainDate | undefined,
): boolean {
  return date !== undefined && isSameDay(clampDate(date, min, max), date);
}

/** Whether `time` is within `[min, max]` (an undefined bound is open); false for no time. */
export function isTimeInRange(
  time: PlainTime | undefined,
  min: PlainTime | undefined,
  max: PlainTime | undefined,
): boolean {
  return time !== undefined && isSameTime(clampTime(time, min, max), time);
}

/** Whether any day of `month` is within `[min, max]` (an undefined bound is open). */
export function isMonthInRange(
  month: PlainYearMonth | PlainDate,
  min: PlainDate | undefined,
  max: PlainDate | undefined,
): boolean {
  const first = firstDay(month);
  const last = first.add({ days: first.daysInMonth - 1 });
  return (
    !(max !== undefined && compareDates(first, max) > 0) &&
    !(min !== undefined && compareDates(last, min) < 0)
  );
}

/** Whether `date` is unavailable under `constraints`: outside `[min, max]` or `isDisabled`; false for no date. */
export function isDateDisabled(
  date: PlainDate | undefined,
  constraints: DateConstraints | undefined,
): boolean {
  if (date === undefined) return false;
  if (!isDateInRange(date, constraints?.min, constraints?.max)) return true;
  return constraints?.isDisabled?.(date) ?? false;
}

// ---- Today and now ----

/** Today in `timeZone` (default: the system's), in `calendar` (default ISO). Read once: it doesn't tick at midnight. */
export function today(timeZone: string | undefined, calendar: string | undefined): PlainDate {
  const date = Temporal.Now.plainDateISO(timeZone);
  return calendar === undefined ? date : date.withCalendar(calendar);
}

/** The time now in `timeZone` (default: the system's), truncated to `granularity` (default "second"). */
export function now(timeZone: string | undefined, granularity: TimeGranularity | undefined): PlainTime {
  return Temporal.Now.plainTimeISO(timeZone).round({
    smallestUnit: granularity ?? "second",
    roundingMode: "trunc",
  });
}

// ---- Weeks ----

function localeTag(locale: Locale): string {
  const first = Array.isArray(locale) ? locale[0] : locale;
  return first ?? new Intl.DateTimeFormat().resolvedOptions().locale;
}

type LocaleWithWeekInfo = Intl.Locale & { getWeekInfo?: () => WeekInfo; weekInfo?: WeekInfo };

/**
 * The locale's first day of the week (1 = Monday … 7 = Sunday) and weekend days, from `Intl.Locale#getWeekInfo`
 * (or the older `weekInfo` getter); Monday and Saturday–Sunday where neither exists or the locale is invalid.
 */
export function weekInfo(locale: Locale): WeekInfo {
  try {
    const tag = new Intl.Locale(localeTag(locale)) as LocaleWithWeekInfo;
    const info = typeof tag.getWeekInfo === "function" ? tag.getWeekInfo() : tag.weekInfo;
    if (info) return { firstDay: info.firstDay, weekend: [...info.weekend] };
  } catch {
    // An invalid tag: fall through to the default.
  }
  return { firstDay: 1, weekend: [6, 7] };
}

/** Whether `date` falls on a weekend day in `locale`. */
export function isWeekend(date: PlainDate, locale: Locale): boolean {
  return weekInfo(locale).weekend.includes(date.dayOfWeek);
}

function resolveFirstDay(locale: Locale, firstDayOfWeek: number | undefined): number {
  return firstDayOfWeek ?? weekInfo(locale).firstDay;
}

// The first day of the week `date` is in, the week starting on `first`.
function startOfWeek(date: PlainDate, first: number): PlainDate {
  return date.subtract({ days: (date.dayOfWeek - first + date.daysInWeek) % date.daysInWeek });
}

// ---- Month grid ----

/**
 * The weeks of `month` as rows of days, in `month`'s calendar, each row starting on the first day of the week.
 * Days before and after the month that fill its first and last rows have `outsideMonth`.
 */
export function monthGrid(month: PlainYearMonth, options: MonthGridOptions | undefined): CalendarWeek[] {
  const first = month.toPlainDate({ day: 1 });
  const length = first.daysInWeek;
  const start = startOfWeek(first, resolveFirstDay(options?.locale, options?.firstDayOfWeek));
  const offset = first.since(start, { largestUnit: "days" }).days;
  const needed = Math.ceil((offset + first.daysInMonth) / length);
  const rows = options?.fixedWeeks ? Math.max(6, needed) : needed;
  return Array.from({ length: rows }, (_, row) => {
    const days = Array.from({ length }, (_unused, column) => {
      const date = start.add({ days: row * length + column });
      return {
        date,
        key: date.toString(),
        outsideMonth: !isSameMonth(month, date),
        dayOfWeek: date.dayOfWeek,
      };
    });
    const thursday = days.find((day) => day.dayOfWeek === 4)?.date ?? days[0].date;
    return { key: days[0].key, weekNumber: thursday.withCalendar(ISO).weekOfYear ?? 0, days };
  });
}

/** The ISO week number of `date` (1–53), whatever its calendar. */
export function isoWeekNumber(date: PlainDate): number {
  return date.withCalendar(ISO).weekOfYear ?? 0;
}

/**
 * The names of the days of the week in `locale`, in grid order from `firstDayOfWeek` (default the locale's).
 * `label` has the given width; `name` is always long (for an `<abbr title>` or `aria-label`).
 */
export function weekdayNames(
  locale: Locale,
  width: "narrow" | "short" | "long",
  firstDayOfWeek: number | undefined,
): WeekdayName[] {
  // 2024-01-01 was a Monday.
  const monday = Temporal.PlainDate.from("2024-01-01");
  const start = monday.add({ days: resolveFirstDay(locale, firstDayOfWeek) - 1 });
  return Array.from({ length: start.daysInWeek }, (_, index) => {
    const date = start.add({ days: index });
    return {
      dayOfWeek: date.dayOfWeek,
      label: formatDateWith(date, locale, { weekday: width }),
      name: formatDateWith(date, locale, { weekday: "long" }),
    };
  });
}

/** `month` as a heading, "November 2026", in its own calendar. */
export function formatMonth(month: PlainYearMonth | PlainDate, locale: Locale): string {
  return formatDateWith(firstDay(month), locale, { year: "numeric", month: "long" });
}

/** The full accessible name of a day, "Tuesday, November 17, 2026", in its own calendar. */
export function formatDayLabel(date: PlainDate, locale: Locale): string {
  return formatDateWith(date, locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

/** The day of the month as a grid cell shows it, "17", in the locale's digits and the date's calendar. */
export function formatDayNumber(date: PlainDate, locale: Locale): string {
  return formatDateWith(date, locale, { day: "numeric" });
}

/** `date` for display, with `Intl`'s `dateStyle` (default "medium"); "" for no date. */
export function formatDate(
  date: PlainDate | undefined,
  locale: Locale,
  style: "full" | "long" | "medium" | "short" | undefined,
): string {
  if (date === undefined) return "";
  return formatDateWith(date, locale, { dateStyle: style ?? "medium" });
}

/** `time` for display down to `granularity` (default "minute"), in the hour cycle given or the locale's; "" for none. */
export function formatTime(
  time: PlainTime | undefined,
  locale: Locale,
  granularity: TimeGranularity | undefined,
  hourCycle: 12 | 24 | undefined,
): string {
  if (time === undefined) return "";
  return formatValue(dateFormat(locale, timeFormatOptions(locale, granularity, hourCycle)), time);
}

/**
 * The months of `visible`'s year (as many as its calendar has), for a month select. A month with no day in
 * `[min, max]` is `disabled`.
 */
export function monthOptions(
  visible: PlainYearMonth,
  locale: Locale,
  min: PlainDate | undefined,
  max: PlainDate | undefined,
): CalendarOption[] {
  const january = visible.toPlainDate({ day: 1 }).with({ month: 1 });
  return Array.from({ length: january.monthsInYear }, (_, index) => {
    const date = january.add({ months: index });
    const value = date.toPlainYearMonth();
    return {
      value,
      key: value.toString(),
      label: formatDateWith(date, locale, { month: "long" }),
      disabled: !isMonthInRange(date, min, max),
    };
  });
}

/**
 * Years for a year select, in `visible`'s calendar: from `min`'s year to `max`'s, ten years either side of
 * `visible` where a bound is missing, and always including `visible`'s. Each keeps `visible`'s month (constrained
 * where that year lacks it). A year with no day in `[min, max]` is `disabled`.
 */
export function yearOptions(
  visible: PlainYearMonth,
  locale: Locale,
  min: PlainDate | undefined,
  max: PlainDate | undefined,
): CalendarOption[] {
  const calendar = visible.calendarId;
  const from = Math.min(min ? min.withCalendar(calendar).year : visible.year - 10, visible.year);
  const to = Math.max(max ? max.withCalendar(calendar).year : visible.year + 10, visible.year);
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => {
    const value = visible.with({ year: from + index }, { overflow: "constrain" });
    const january = value.toPlainDate({ day: 1 }).with({ month: 1 });
    const december = january.add({ months: january.monthsInYear - 1 });
    const disabled =
      (max !== undefined && compareDates(january, max) > 0) ||
      (min !== undefined && compareDates(december.add({ days: december.daysInMonth - 1 }), min) < 0);
    return {
      value,
      key: value.toString(),
      label: formatDateWith(january, locale, { year: "numeric" }),
      disabled,
    };
  });
}

// ---- Keyboard movement in a grid ----

/**
 * The move a key makes in a calendar grid, as the WAI-ARIA date picker pattern defines it (arrows, Home, End,
 * PageUp/PageDown, Shift+PageUp/PageDown for a year); arrows swap sides when `rtl`. Undefined for other keys.
 */
export function dateMoveForKey(key: string, shiftKey: boolean, rtl: boolean): DateMove | undefined {
  switch (key) {
    case "ArrowRight":
      return rtl ? "previous-day" : "next-day";
    case "ArrowLeft":
      return rtl ? "next-day" : "previous-day";
    case "ArrowDown":
      return "next-week";
    case "ArrowUp":
      return "previous-week";
    case "PageDown":
      return shiftKey ? "next-year" : "next-month";
    case "PageUp":
      return shiftKey ? "previous-year" : "previous-month";
    case "Home":
      return "start-of-week";
    case "End":
      return "end-of-week";
    default:
      return undefined;
  }
}

/**
 * Where focus goes from `date` after `move`: clamped into `[min, max]`, and past days `isDisabled` refuses, looking
 * on in the move's direction (towards `date` for start/end of week). A move cut short by a bound whose day is unavailable
 * looks back from the bound. `date` itself when there is nowhere to go.
 */
export function moveDate(date: PlainDate, move: DateMove, options: MoveOptions | undefined): PlainDate {
  const first = resolveFirstDay(options?.locale, options?.firstDayOfWeek);
  let target: PlainDate;
  let direction = 1;
  switch (move) {
    case "next-day":
      target = date.add({ days: 1 });
      break;
    case "previous-day":
      target = date.subtract({ days: 1 });
      direction = -1;
      break;
    case "next-week":
      target = date.add({ days: date.daysInWeek });
      break;
    case "previous-week":
      target = date.subtract({ days: date.daysInWeek });
      direction = -1;
      break;
    case "next-month":
      target = date.add({ months: 1 });
      break;
    case "previous-month":
      target = date.subtract({ months: 1 });
      direction = -1;
      break;
    case "next-year":
      target = date.add({ years: 1 });
      break;
    case "previous-year":
      target = date.subtract({ years: 1 });
      direction = -1;
      break;
    case "start-of-week":
      target = startOfWeek(date, first);
      break;
    case "end-of-week":
      target = startOfWeek(date, first).add({ days: date.daysInWeek - 1 });
      direction = -1;
      break;
  }
  const clamped = clampDate(target, options?.min, options?.max) ?? target;
  const ahead = nearestAvailable(clamped, direction, options);
  if (ahead !== undefined) return ahead;
  // A target past a bound stops at the bound; if that day is unavailable, look back from it towards `date`.
  return (isSameDay(clamped, target) ? undefined : nearestAvailable(clamped, -direction, options)) ?? date;
}

// The first day from `start` on in `direction` that `constraints` allow, within [min, max] and MAX_SEARCH days.
function nearestAvailable(
  start: PlainDate,
  direction: number,
  constraints: DateConstraints | undefined,
): PlainDate | undefined {
  let date = start;
  for (let step = 0; step < MAX_SEARCH; step += 1) {
    if (!isDateInRange(date, constraints?.min, constraints?.max)) return undefined;
    if (!constraints?.isDisabled?.(date)) return date;
    date = date.add({ days: direction });
  }
  return undefined;
}

/**
 * The day of `month` that takes focus when the grid is entered: `selected` if it is in `month` and available,
 * else `today` on the same terms, else the first available day of the month, else the month's first day.
 */
export function defaultFocusDate(
  month: PlainYearMonth,
  selected: PlainDate | undefined,
  todayDate: PlainDate | undefined,
  constraints: DateConstraints | undefined,
): PlainDate {
  for (const candidate of [selected, todayDate]) {
    if (candidate !== undefined && isSameMonth(month, candidate) && !isDateDisabled(candidate, constraints)) {
      return candidate.withCalendar(month.calendarId);
    }
  }
  const first = month.toPlainDate({ day: 1 });
  const found = nearestAvailable(
    clampDate(first, constraints?.min, constraints?.max) ?? first,
    1,
    constraints,
  );
  return found !== undefined && isSameMonth(month, found) ? found : first;
}

// ---- Ranges ----

/** `a` and `b` as a range in order; undefined unless both are given. */
export function normalizeRange(a: PlainDate | undefined, b: PlainDate | undefined): DateRange | undefined {
  if (a === undefined || b === undefined) return undefined;
  return Temporal.PlainDate.compare(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a };
}

/** Whether `date` is within `range`, ends included; false for no date or no range. */
export function isInRange(date: PlainDate | undefined, range: DateRange | undefined): boolean {
  return range !== undefined && isDateInRange(date, range.start, range.end);
}

/** Whether `date` is the first day of `range`; false for no date or no range. */
export function isRangeStart(date: PlainDate | undefined, range: DateRange | undefined): boolean {
  return date !== undefined && range !== undefined && isSameDay(date, range.start);
}

/** Whether `date` is the last day of `range`; false for no date or no range. */
export function isRangeEnd(date: PlainDate | undefined, range: DateRange | undefined): boolean {
  return date !== undefined && range !== undefined && isSameDay(date, range.end);
}

/**
 * The range to highlight: while a selection is under way (`anchor`, the first day picked), from `anchor` to the
 * day hovered or focused (`anchor` alone when there is none); otherwise `range`, which may be undefined.
 */
export function previewRange(
  anchor: PlainDate | undefined,
  hovered: PlainDate | undefined,
  range: DateRange | undefined,
): DateRange | undefined {
  if (anchor === undefined) return range;
  return normalizeRange(anchor, hovered ?? anchor);
}

/** Whether any day of `range` is unavailable under `constraints`; false for no range. */
export function rangeHasDisabledDate(
  range: DateRange | undefined,
  constraints: DateConstraints | undefined,
): boolean {
  if (range === undefined) return false;
  if (isDateDisabled(range.start, constraints) || isDateDisabled(range.end, constraints)) return true;
  if (!constraints?.isDisabled) return false;
  for (let date = range.start; compareDates(date, range.end) <= 0; date = date.add({ days: 1 })) {
    if (constraints.isDisabled(date)) return true;
  }
  return false;
}

// ---- Form strings ----

/** The day `text` names (an ISO string, `2026-11-17`), in `calendar` if given; undefined for empty or bad text. */
export function parseDate(
  text: string | null | undefined,
  calendar: string | undefined,
): PlainDate | undefined {
  if (!text) return undefined;
  try {
    const date = Temporal.PlainDate.from(text.trim());
    return calendar === undefined ? date : date.withCalendar(calendar);
  } catch {
    return undefined;
  }
}

/** The time `text` names (`13:45`, `13:45:00`); undefined for empty or bad text. */
export function parseTime(text: string | null | undefined): PlainTime | undefined {
  if (!text) return undefined;
  try {
    return Temporal.PlainTime.from(text.trim());
  } catch {
    return undefined;
  }
}

/** The month `text` names (`2026-11`, or a date in it); undefined for empty or bad text. */
export function parseYearMonth(text: string | null | undefined): PlainYearMonth | undefined {
  if (!text) return undefined;
  try {
    return Temporal.PlainYearMonth.from(text.trim());
  } catch {
    return undefined;
  }
}

/** `date` as a form submits it, `2026-11-17` (converted to ISO from any calendar); "" for no date. */
export function dateToString(date: PlainDate | undefined): string {
  return date === undefined ? "" : date.withCalendar(ISO).toString({ calendarName: "never" });
}

/** `time` as a form submits it, down to `granularity` (default "second": `13:45:00`); "" for no time. */
export function timeToString(time: PlainTime | undefined, granularity: TimeGranularity | undefined): string {
  if (time === undefined) return "";
  const text = time.toString({ smallestUnit: granularity === "hour" ? "minute" : (granularity ?? "second") });
  return granularity === "hour" ? `${text.slice(0, 2)}:00` : text;
}

// ---- Hour cycle and time lists ----

/** The hour cycle a time field uses: `override` 24 gives "h23"; 12 or none, the locale's (h11 or h12 when 12). */
export function hourCycleOf(locale: Locale, override: 12 | 24 | undefined): HourCycle {
  if (override === 24) return "h23";
  const options: Intl.DateTimeFormatOptions =
    override === 12 ? { hour: "numeric", hour12: true } : { hour: "numeric" };
  const resolved = dateFormat(locale, options).resolvedOptions().hourCycle;
  if (resolved === "h11" || resolved === "h12") return resolved;
  return override === 12 ? "h12" : "h23";
}

function timeFormatOptions(
  locale: Locale,
  granularity: TimeGranularity | undefined,
  hourCycle: 12 | 24 | undefined,
): Intl.DateTimeFormatOptions {
  const unit = granularity ?? "minute";
  return {
    hour: "numeric",
    ...(unit === "hour" ? {} : { minute: "2-digit" }),
    ...(unit === "second" ? { second: "2-digit" } : {}),
    hourCycle: hourCycleOf(locale, hourCycle),
  };
}

function displayHour(hour: number, cycle: HourCycle): number {
  if (cycle === "h23") return hour;
  return cycle === "h12" ? hour % 12 || 12 : hour % 12;
}

function hourFromDisplay(shown: number, cycle: HourCycle, dayPeriod: number | undefined): number {
  if (cycle === "h23") return shown;
  return (shown % 12) + (dayPeriod === 1 ? 12 : 0);
}

// The locale's numbering system, its digits, and how wide each time and date number is shown.
type FieldStyle = {
  numberingSystem: string;
  digits: string[];
  widths: Partial<Record<SegmentKind, number>>;
  dayPeriods: [string, string];
};

const styles = new Map<string, FieldStyle>();

function fieldStyle(format: Intl.DateTimeFormat, locale: Locale, sample: PlainDate | PlainTime): FieldStyle {
  const key = JSON.stringify([format.resolvedOptions(), sample.toString()]);
  let found = styles.get(key);
  if (found) return found;
  const { numberingSystem } = format.resolvedOptions();
  const digits = Array.from({ length: 10 }, (_, digit) =>
    numberFormat(locale, numberingSystem, 1).format(digit),
  );
  const widths: Partial<Record<SegmentKind, number>> = {};
  for (const part of formatParts(format, sample)) {
    // A single-digit value shown with two digits is padded; anything else (a month name) isn't.
    if (isKind(part.type))
      widths[part.type] = Array.from(part.value).every((ch) => digits.includes(ch))
        ? Array.from(part.value).length
        : 1;
  }
  found = { numberingSystem, digits, widths, dayPeriods: dayPeriodLabels(locale) };
  styles.set(key, found);
  return found;
}

function dayPeriodLabels(locale: Locale): [string, string] {
  const format = dateFormat(locale, { hour: "numeric", hourCycle: "h12" });
  const label = (hour: number) =>
    formatParts(format, Temporal.PlainTime.from({ hour })).find((part) => part.type === "dayPeriod")?.value ??
    (hour < 12 ? "AM" : "PM");
  return [label(9), label(21)];
}

function isKind(type: string): type is SegmentKind {
  return ["year", "month", "day", "hour", "minute", "second", "dayPeriod"].includes(type);
}

function timeOptionLabel(locale: Locale, value: number, kind: SegmentKind, cycle: HourCycle): string {
  const format = dateFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: cycle,
  });
  const style = fieldStyle(format, locale, Temporal.PlainTime.from({ hour: 9, minute: 5, second: 5 }));
  return numberFormat(locale, style.numberingSystem, style.widths[kind] ?? 1).format(value);
}

/**
 * The hours a time picker lists, labelled in the locale's hour cycle (or `hourCycle`'s). In 24-hour time, 0–23;
 * in 12-hour time, the twelve hours of `dayPeriod` (0 = AM, the default; 1 = PM), labelled 12, 1 … 11 (or 0 … 11
 * for h11). `value` is always the 0–23 hour.
 */
export function hourOptions(
  locale: Locale,
  hourCycle: 12 | 24 | undefined,
  dayPeriod: number | undefined,
): TimeOption[] {
  const cycle = hourCycleOf(locale, hourCycle);
  const count = cycle === "h23" ? 24 : 12;
  const base = cycle !== "h23" && dayPeriod === 1 ? 12 : 0;
  return Array.from({ length: count }, (_, index) => ({
    value: base + index,
    label: timeOptionLabel(locale, displayHour(base + index, cycle), "hour", cycle),
  }));
}

/** The minutes a time picker lists, every `step` minutes (default 1) from 0, two digits in the locale's numerals. */
export function minuteOptions(locale: Locale, step: number | undefined): TimeOption[] {
  return sixtyOptions(locale, step, "minute");
}

/** The seconds a time picker lists, every `step` seconds (default 1) from 0, two digits in the locale's numerals. */
export function secondOptions(locale: Locale, step: number | undefined): TimeOption[] {
  return sixtyOptions(locale, step, "second");
}

function sixtyOptions(locale: Locale, step: number | undefined, kind: SegmentKind): TimeOption[] {
  const every = step !== undefined && step >= 1 ? Math.floor(step) : 1;
  return Array.from({ length: Math.ceil(60 / every) }, (_, index) => ({
    value: index * every,
    label: timeOptionLabel(locale, index * every, kind, "h23"),
  }));
}

/** AM and PM in the locale ("오전", "오후" in Korean): values 0 and 1. */
export function dayPeriodOptions(locale: Locale): TimeOption[] {
  const [am, pm] = dayPeriodLabels(locale);
  return [
    { value: 0, label: am },
    { value: 1, label: pm },
  ];
}

/** `time` moved into `dayPeriod` (0 = AM, 1 = PM), keeping its hour on the clock face; undefined for no time. */
export function withDayPeriod(time: PlainTime | undefined, dayPeriod: number): PlainTime | undefined {
  return time?.with({ hour: (time.hour % 12) + (dayPeriod === 1 ? 12 : 0) });
}

// ---- The segmented field ----

type Field = {
  options: FieldOptions;
  calendar: string;
  cycle: HourCycle;
  granularity: TimeGranularity;
  format: Intl.DateTimeFormat;
  style: FieldStyle;
  placeholder: PlainDate | PlainTime;
};

function field(options: FieldOptions): Field {
  const calendar = options.calendar ?? ISO;
  const granularity = options.granularity ?? "minute";
  const cycle = hourCycleOf(options.locale, options.hourCycle);
  if (options.type === "date") {
    const format = dateFormat(options.locale, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      calendar: displayCalendar(calendar),
    });
    const placeholder =
      options.placeholderValue && "calendarId" in options.placeholderValue
        ? options.placeholderValue.withCalendar(calendar)
        : today(undefined, calendar);
    const sample = Temporal.PlainDate.from({ year: placeholder.year, month: 1, day: 5, calendar });
    return {
      options,
      calendar,
      cycle,
      granularity,
      format,
      style: fieldStyle(format, options.locale, sample),
      placeholder,
    };
  }
  const format = dateFormat(
    options.locale,
    timeFormatOptions(options.locale, granularity, options.hourCycle),
  );
  const placeholder =
    options.placeholderValue && !("calendarId" in options.placeholderValue)
      ? options.placeholderValue
      : Temporal.PlainTime.from({ hour: 0 });
  const sample = Temporal.PlainTime.from({ hour: 9, minute: 5, second: 5 });
  return {
    options,
    calendar,
    cycle,
    granularity,
    format,
    style: fieldStyle(format, options.locale, sample),
    placeholder,
  };
}

const monthCounts = new Map<string, number>();

// The months in `year`, or the most in any year near the placeholder's while the year is empty.
function monthsInYear(f: Field, year: number | undefined): number {
  const key = `${f.calendar}|${year ?? `~${(f.placeholder as PlainDate).year}`}`;
  let found = monthCounts.get(key);
  if (found === undefined) {
    const years = year !== undefined ? [year] : probeYears(f);
    found = Math.max(
      ...years.map(
        (y) => Temporal.PlainDate.from({ year: y, month: 1, day: 1, calendar: f.calendar }).monthsInYear,
      ),
    );
    monthCounts.set(key, found);
  }
  return found;
}

const dayCounts = new Map<string, number>();

// The days in the month, or the most it (or any month, while the month is empty) has in the years near the
// placeholder's while the year is empty.
function daysInMonth(f: Field, year: number | undefined, month: number | undefined): number {
  const key = `${f.calendar}|${year ?? `~${(f.placeholder as PlainDate).year}`}|${month ?? "~"}`;
  let found = dayCounts.get(key);
  if (found === undefined) {
    const years = year !== undefined ? [year] : probeYears(f);
    found = 0;
    for (const y of years) {
      const january = Temporal.PlainDate.from({ year: y, month: 1, day: 1, calendar: f.calendar });
      const months =
        month !== undefined
          ? [Math.min(month, january.monthsInYear)]
          : Array.from({ length: january.monthsInYear }, (_, i) => i + 1);
      for (const m of months) found = Math.max(found, january.with({ month: m }).daysInMonth);
    }
    dayCounts.set(key, found);
  }
  return found;
}

function probeYears(f: Field): number[] {
  const from = (f.placeholder as PlainDate).year;
  return Array.from({ length: PROBE_YEARS }, (_, i) => from + i);
}

function segmentRange(f: Field, kind: SegmentKind, values: SegmentValues): [number, number] {
  switch (kind) {
    case "year":
      return [1, 9999];
    case "month":
      return [1, monthsInYear(f, values.year)];
    case "day":
      return [1, daysInMonth(f, values.year, values.month)];
    case "hour":
      return f.cycle === "h23" ? [0, 23] : f.cycle === "h12" ? [1, 12] : [0, 11];
    case "minute":
    case "second":
      return [0, 59];
    case "dayPeriod":
      return [0, 1];
  }
}

// What the segment shows: the hour on the clock face, the others as held.
function shownValue(f: Field, kind: SegmentKind, values: SegmentValues): number | undefined {
  const value = values[kind];
  return kind === "hour" && value !== undefined ? displayHour(value, f.cycle) : value;
}

// `values` with `kind` set to the shown value `next`: the hour converted to 0–23, the day period moving the hour,
// and the day kept within the month when `clamp`.
function store(
  f: Field,
  values: SegmentValues,
  kind: SegmentKind,
  next: number | undefined,
  clamp: boolean,
): SegmentValues {
  const result: SegmentValues = { ...values };
  if (kind === "hour") {
    result.hour = next === undefined ? undefined : hourFromDisplay(next, f.cycle, values.dayPeriod);
  } else if (kind === "dayPeriod") {
    result.dayPeriod = next;
    if (next !== undefined && values.hour !== undefined) result.hour = (values.hour % 12) + next * 12;
  } else {
    result[kind] = next;
  }
  if (clamp && (kind === "year" || kind === "month") && result.day !== undefined) {
    result.day = Math.min(result.day, daysInMonth(f, result.year, result.month));
  }
  return result;
}

function segmentText(f: Field, kind: SegmentKind, value: number): string {
  if (kind === "dayPeriod") return f.style.dayPeriods[value === 1 ? 1 : 0];
  const width =
    kind === "year" ? 1 : (f.style.widths[kind] ?? (kind === "minute" || kind === "second" ? 2 : 1));
  return numberFormat(f.options.locale, f.style.numberingSystem, width).format(value);
}

function segmentLabel(locale: Locale, kind: SegmentKind): string {
  try {
    return new Intl.DisplayNames(locale, { type: "dateTimeField" }).of(kind) ?? kind;
  } catch {
    return kind;
  }
}

function placeholderText(kind: SegmentKind): string {
  return kind === "year" ? "––––" : "––";
}

/**
 * The field's segments and the literals between them, in the locale's order (from `formatToParts`). A time
 * field has hour, minute and second down to `granularity`, and a day period in 12-hour time.
 */
export function fieldSegments(values: SegmentValues, options: FieldOptions): FieldSegment[] {
  const f = field(options);
  const sample =
    options.type === "date" ? f.placeholder : Temporal.PlainTime.from({ hour: 9, minute: 5, second: 5 });
  return formatParts(f.format, sample).map((part): FieldSegment => {
    if (!isKind(part.type)) {
      return {
        kind: "literal",
        text: part.value,
        value: undefined,
        min: 0,
        max: 0,
        placeholder: part.value,
        editable: false,
        label: "",
        valueText: undefined,
      };
    }
    const kind = part.type;
    const [min, max] = segmentRange(f, kind, values);
    const value = shownValue(f, kind, values);
    const text = value === undefined ? placeholderText(kind) : segmentText(f, kind, value);
    let valueText = value === undefined ? undefined : text;
    if (kind === "month" && value !== undefined) {
      const year = values.year ?? (f.placeholder as PlainDate).year;
      const date = Temporal.PlainDate.from(
        { year, month: value, day: 1, calendar: f.calendar },
        { overflow: "constrain" },
      );
      valueText = `${text} – ${formatDateWith(date, options.locale, { month: "long" })}`;
    }
    return {
      kind,
      text,
      value,
      min,
      max,
      placeholder: placeholderText(kind),
      editable: true,
      label: segmentLabel(options.locale, kind),
      valueText,
    };
  });
}

// What an empty segment becomes when stepped: the placeholder value's, as the segment shows it.
function placeholderShown(f: Field, kind: SegmentKind): number {
  const value = f.placeholder;
  if ("calendarId" in value) return kind === "year" ? value.year : kind === "month" ? value.month : value.day;
  if (kind === "dayPeriod") return value.hour >= 12 ? 1 : 0;
  if (kind === "hour") return displayHour(value.hour, f.cycle);
  return kind === "second" ? value.second : value.minute;
}

/**
 * `values` with segment `kind` stepped by `delta` (±1 for the arrows, more for PageUp/PageDown), wrapping within
 * the segment (the year clamps to 1–9999; a 12-hour hour keeps its day period). An empty segment takes the
 * placeholder value's instead. The day is kept within the month when the year or month changes.
 */
export function incrementSegment(
  values: SegmentValues,
  kind: SegmentKind,
  delta: number,
  options: FieldOptions,
): SegmentValues {
  const f = field(options);
  const current = shownValue(f, kind, values);
  let next: number;
  if (current === undefined) {
    next = placeholderShown(f, kind);
  } else {
    const [min, max] = segmentRange(f, kind, values);
    if (kind === "year") next = Math.min(max, Math.max(min, current + delta));
    else next = min + ((((current - min + delta) % (max - min + 1)) + (max - min + 1)) % (max - min + 1));
  }
  return store(f, values, kind, next, true);
}

/** `values` with segment `kind` set to the shown value `value` (the hour as on the clock face), the day kept within the month. */
export function setSegment(
  values: SegmentValues,
  kind: SegmentKind,
  value: number | undefined,
  options: FieldOptions,
): SegmentValues {
  return store(field(options), values, kind, value, true);
}

/** `values` with segment `kind` emptied. */
export function clearSegment(values: SegmentValues, kind: SegmentKind): SegmentValues {
  return { ...values, [kind]: undefined };
}

/** `values` with the last digit of segment `kind` removed (Backspace); the segment empties from one digit, or for the day period. */
export function backspaceSegment(
  values: SegmentValues,
  kind: SegmentKind,
  options: FieldOptions,
): SegmentValues {
  const f = field(options);
  const current = shownValue(f, kind, values);
  if (current === undefined || kind === "dayPeriod" || current < 10) return clearSegment(values, kind);
  const next = Math.floor(current / 10);
  const [min] = segmentRange(f, kind, values);
  return store(f, values, kind, next < min ? undefined : next, false);
}

function digitOf(key: string, digits: string[]): number | undefined {
  if (/^[0-9]$/u.test(key)) return Number(key);
  const index = digits.indexOf(key);
  return index === -1 ? undefined : index;
}

/**
 * The result of typing `key` into segment `kind`, given the digits already typed into it since it took focus
 * (`buffer`, "" at first). Digits (ASCII or the locale's) build the number; one that would pass the maximum starts
 * over from this digit. `advance` says to move to the next segment: the number can take no more digits. For the
 * day period, the first letter of AM or PM (or a/p) sets it and advances. Any other key leaves `values` alone.
 */
export function typeIntoSegment(
  values: SegmentValues,
  kind: SegmentKind,
  buffer: string,
  key: string,
  options: FieldOptions,
): SegmentEntry {
  const f = field(options);
  if (kind === "dayPeriod") {
    const typed = key.toLocaleLowerCase();
    const [am, pm] = f.style.dayPeriods.map((label) => label.toLocaleLowerCase());
    const period =
      typed === "a" || am.startsWith(typed) ? 0 : typed === "p" || pm.startsWith(typed) ? 1 : undefined;
    if (typed === "" || period === undefined) return { values, buffer, advance: false };
    return { values: store(f, values, kind, period, true), buffer: "", advance: true };
  }
  const digit = digitOf(key, f.style.digits);
  if (digit === undefined) return { values, buffer, advance: false };
  const [min, max] = segmentRange(f, kind, values);
  const length = kind === "year" ? 4 : String(max).length;
  let typed = `${buffer}${digit}`;
  if (Number(typed) > max || typed.length > length) typed = String(digit);
  const number = Number(typed);
  const advance = typed.length >= length || number * 10 > max;
  if (number < min) {
    // "0" in a month: wait for the next digit, or give up after the segment's width.
    return advance ? { values, buffer: "", advance: false } : { values, buffer: typed, advance: false };
  }
  // The day is clamped once the year or month is finished, not on each digit of a year still being typed.
  return {
    values: store(f, values, kind, number, advance || kind === "month"),
    buffer: advance ? "" : typed,
    advance,
  };
}

/** The segments of `date` in the field's calendar; all empty for no date. */
export function dateToSegments(date: PlainDate | undefined, calendar: string | undefined): SegmentValues {
  if (date === undefined) return {};
  const inCalendar = date.withCalendar(calendar ?? ISO);
  return { year: inCalendar.year, month: inCalendar.month, day: inCalendar.day };
}

/** The segments of `time` (hour 0–23, with its day period); all empty for no time. */
export function timeToSegments(time: PlainTime | undefined): SegmentValues {
  if (time === undefined) return {};
  return { hour: time.hour, minute: time.minute, second: time.second, dayPeriod: time.hour >= 12 ? 1 : 0 };
}

/** The date the segments make, in the field's calendar; undefined while any is empty or the day doesn't exist. */
export function segmentsToDate(values: SegmentValues, options: FieldOptions): PlainDate | undefined {
  const { year, month, day } = values;
  if (year === undefined || month === undefined || day === undefined) return undefined;
  try {
    return Temporal.PlainDate.from(
      { year, month, day, calendar: options.calendar ?? ISO },
      { overflow: "reject" },
    );
  } catch {
    return undefined;
  }
}

/**
 * The time the segments make; undefined while a segment the field shows is empty (the day period too, in
 * 12-hour time). Segments finer than `granularity` count as 0.
 */
export function segmentsToTime(values: SegmentValues, options: FieldOptions): PlainTime | undefined {
  const granularity = options.granularity ?? "minute";
  const { hour, minute, second, dayPeriod } = values;
  if (hour === undefined) return undefined;
  if (hourCycleOf(options.locale, options.hourCycle) !== "h23" && dayPeriod === undefined) return undefined;
  if (granularity !== "hour" && minute === undefined) return undefined;
  if (granularity === "second" && second === undefined) return undefined;
  return Temporal.PlainTime.from({
    hour,
    minute: granularity === "hour" ? 0 : minute,
    second: granularity === "second" ? second : 0,
  });
}
