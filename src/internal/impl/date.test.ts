// The date core, run twice: on the engine's own Temporal, and on temporal-polyfill installed in its place (what
// Safari users get until it ships Temporal). Then the .rx example of holding a Temporal value in state.
import { Intl as PolyfillIntl, Temporal as PolyfillTemporal } from "temporal-polyfill/full/implementation";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { mount } from "../../test/mount.ts";
import type { FieldOptions } from "./date.ts";
import bareSource from "../fixtures/date-bare-source.rx";
import holding from "../fixtures/date.rx";

type Core = typeof import("./date.ts");

const day = (text: string) => Temporal.PlainDate.from(text);
const time = (text: string) => Temporal.PlainTime.from(text);
const month = (text: string) => Temporal.PlainYearMonth.from(text);
const keys = (dates: (Temporal.PlainDate | undefined)[]) => dates.map((date) => date?.toString());
const weekend = (date: Temporal.PlainDate) => date.dayOfWeek >= 6;
const firstKeys = (weeks: ReturnType<Core["monthGrid"]>) => weeks.map((week) => week.days[0].key);
// A function, so each engine's run makes its own placeholder value.
const dateField = () => ({ type: "date", locale: "en-US", placeholderValue: day("2026-11-17") }) as const;
const kinds = (segments: ReturnType<Core["fieldSegments"]>) =>
  segments.map((segment) => (segment.kind === "literal" ? segment.text : segment.kind)).join("");

describe.each(["native", "polyfill"] as const)("%s Temporal", (engine) => {
  let d: Core;
  const native = { Temporal: globalThis.Temporal, DateTimeFormat: Intl.DateTimeFormat };

  beforeAll(async () => {
    if (engine === "polyfill") {
      Object.assign(globalThis, { Temporal: PolyfillTemporal });
      Object.assign(Intl, { DateTimeFormat: PolyfillIntl.DateTimeFormat });
    }
    // A fresh module, so no formatter cached under the other engine is reused.
    vi.resetModules();
    d = await import("./date.ts");
  });

  afterAll(() => {
    Object.assign(globalThis, { Temporal: native.Temporal });
    Object.assign(Intl, { DateTimeFormat: native.DateTimeFormat });
  });

  test("runs on the engine it says", () => {
    expect(Temporal === native.Temporal).toBe(engine === "native");
  });

  describe("equality and order", () => {
    test("same day, month and time tolerate undefined", () => {
      expect(d.isSameDay(day("2026-11-17"), day("2026-11-17"))).toBe(true);
      expect(d.isSameDay(day("2026-11-17"), day("2026-11-18"))).toBe(false);
      expect(d.isSameDay(undefined, undefined)).toBe(true);
      expect(d.isSameDay(day("2026-11-17"), undefined)).toBe(false);
      expect(d.isSameDay(day("2026-11-17").withCalendar("hebrew"), day("2026-11-17"))).toBe(true);
      expect(d.isSameMonth(day("2026-11-01"), month("2026-11"))).toBe(true);
      expect(d.isSameMonth(month("2026-11"), day("2026-12-01"))).toBe(false);
      expect(d.isSameMonth(undefined, month("2026-11"))).toBe(false);
      // 17 November 2026 is 7 Kislev 5787; 1 December is 21 Kislev, 11 December 1 Tevet.
      const kislev = day("2026-11-17").withCalendar("hebrew").toPlainYearMonth();
      expect(d.isSameMonth(kislev, day("2026-12-01"))).toBe(true);
      expect(d.isSameMonth(kislev, day("2026-12-11"))).toBe(false);
      expect(d.isSameTime(time("13:45"), time("13:45:00"))).toBe(true);
      expect(d.isSameTime(time("13:45"), undefined)).toBe(false);
    });

    test("compare, min, max and clamp", () => {
      expect(d.compareDates(day("2026-11-17"), day("2026-11-18"))).toBeLessThan(0);
      expect(d.compareDates(undefined, day("2026-11-18"))).toBeLessThan(0);
      expect(d.compareDates(undefined, undefined)).toBe(0);
      expect(d.compareMonths(day("2026-11-30"), month("2026-11"))).toBe(0);
      expect(d.compareMonths(month("2026-10"), day("2026-11-01"))).toBeLessThan(0);
      expect(d.compareTimes(time("09:00"), time("08:59"))).toBeGreaterThan(0);
      expect(d.minDate(day("2026-11-17"), undefined)?.toString()).toBe("2026-11-17");
      expect(d.minDate(day("2026-11-17"), day("2026-01-01"))?.toString()).toBe("2026-01-01");
      expect(d.maxDate(day("2026-11-17"), day("2026-01-01"))?.toString()).toBe("2026-11-17");
      expect(d.maxDate(undefined, undefined)).toBeUndefined();
      const [min, max] = [day("2026-11-10"), day("2026-11-20")];
      expect(
        keys([d.clampDate(day("2026-11-01"), min, max), d.clampDate(day("2026-12-01"), min, max)]),
      ).toEqual(["2026-11-10", "2026-11-20"]);
      expect(d.clampDate(day("2026-12-01"), undefined, undefined)?.toString()).toBe("2026-12-01");
      expect(d.clampDate(undefined, min, max)).toBeUndefined();
      expect(d.clampTime(time("23:00"), undefined, time("18:00"))?.toString()).toBe("18:00:00");
    });

    test("in range, month in range, disabled", () => {
      const [min, max] = [day("2026-11-10"), day("2026-11-20")];
      expect(d.isDateInRange(day("2026-11-10"), min, max)).toBe(true);
      expect(d.isDateInRange(day("2026-11-21"), min, max)).toBe(false);
      expect(d.isDateInRange(day("2099-01-01"), min, undefined)).toBe(true);
      expect(d.isDateInRange(undefined, min, max)).toBe(false);
      expect(d.isTimeInRange(time("12:00"), time("09:00"), time("17:00"))).toBe(true);
      expect(d.isTimeInRange(time("08:00"), time("09:00"), undefined)).toBe(false);
      expect(d.isMonthInRange(month("2026-10"), day("2026-10-31"), undefined)).toBe(true);
      expect(d.isMonthInRange(month("2026-10"), day("2026-11-01"), undefined)).toBe(false);
      expect(d.isMonthInRange(month("2026-12"), undefined, day("2026-11-30"))).toBe(false);
      expect(d.isDateDisabled(day("2026-11-21"), { isDisabled: weekend })).toBe(true);
      expect(d.isDateDisabled(day("2026-11-25"), { min, max })).toBe(true);
      expect(d.isDateDisabled(day("2026-11-17"), { min, max, isDisabled: weekend })).toBe(false);
      expect(d.isDateDisabled(undefined, { min, max })).toBe(false);
    });
  });

  describe("today and now", () => {
    test("in a time zone and a calendar", () => {
      expect(d.today("UTC", undefined).toString()).toBe(Temporal.Now.plainDateISO("UTC").toString());
      expect(d.today(undefined, "hebrew").calendarId).toBe("hebrew");
      expect(d.now("UTC", "minute").second).toBe(0);
      expect(d.now(undefined, undefined).millisecond).toBe(0);
    });
  });

  describe("weeks", () => {
    test("first day and weekend from the locale", () => {
      expect(d.weekInfo("en-US")).toEqual({ firstDay: 7, weekend: [6, 7] });
      expect(d.weekInfo("en-GB").firstDay).toBe(1);
      expect(d.weekInfo("ar-EG").firstDay).toBe(6);
      expect(d.weekInfo("en-GB-u-fw-wed").firstDay).toBe(3);
      expect(d.isWeekend(day("2026-11-21"), "en-US")).toBe(true);
      expect(d.isWeekend(day("2026-11-20"), "fa-IR")).toBe(true);
    });

    test("falls back to Monday and Saturday–Sunday", () => {
      expect(d.weekInfo("not a locale!")).toEqual({ firstDay: 1, weekend: [6, 7] });
      const proto = Intl.Locale.prototype as Intl.Locale & { getWeekInfo?: unknown };
      const original = Object.getOwnPropertyDescriptor(proto, "getWeekInfo");
      Reflect.deleteProperty(proto, "getWeekInfo");
      try {
        expect(d.weekInfo("en-US")).toEqual({ firstDay: 1, weekend: [6, 7] });
      } finally {
        if (original) Object.defineProperty(proto, "getWeekInfo", original);
      }
    });
  });

  describe("month grid", () => {
    test("a week starting on Sunday, Monday or Saturday", () => {
      // 1 November 2026 is a Sunday.
      const us = d.monthGrid(month("2026-11"), { locale: "en-US" });
      expect(firstKeys(us)).toEqual(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"]);
      expect(us.at(-1)?.days.at(-1)?.key).toBe("2026-12-05");
      const gb = d.monthGrid(month("2026-11"), { locale: "en-GB" });
      expect(firstKeys(gb)[0]).toBe("2026-10-26");
      expect(gb).toHaveLength(6);
      const eg = d.monthGrid(month("2026-11"), { locale: "ar-EG" });
      expect(firstKeys(eg)[0]).toBe("2026-10-31");
      expect(
        eg
          .flatMap((week) => week.days)
          .every((cell, i, all) => i === 0 || cell.dayOfWeek !== all[i - 1].dayOfWeek),
      ).toBe(true);
      const override = d.monthGrid(month("2026-11"), { locale: "en-US", firstDayOfWeek: 3 });
      expect(firstKeys(override)[0]).toBe("2026-10-28");
    });

    test("days outside the month, fixed weeks, week numbers", () => {
      const weeks = d.monthGrid(month("2026-11"), { locale: "en-US", fixedWeeks: true });
      expect(weeks).toHaveLength(6);
      expect(weeks.every((week) => week.days.length === 7)).toBe(true);
      const cells = weeks.flatMap((week) => week.days);
      expect(cells.filter((cell) => !cell.outsideMonth)).toHaveLength(30);
      expect(cells.find((cell) => cell.key === "2026-12-01")?.outsideMonth).toBe(true);
      // The row of 1–7 November has its Thursday, the 5th, in ISO week 45.
      expect(weeks[0].weekNumber).toBe(45);
      expect(weeks[0].key).toBe("2026-11-01");
      expect(d.monthGrid(month("2026-11"), { locale: "en-GB" })[0].weekNumber).toBe(44);
      expect(d.monthGrid(month("2026-02"), undefined).length).toBeGreaterThanOrEqual(4);
      expect(d.isoWeekNumber(day("2026-11-17").withCalendar("hebrew"))).toBe(47);
    });

    test("a Hebrew month, laid out in its own calendar", () => {
      const kislev = day("2026-11-17").withCalendar("hebrew").toPlainYearMonth();
      const cells = d.monthGrid(kislev, { locale: "en-US" }).flatMap((week) => week.days);
      const inside = cells.filter((cell) => !cell.outsideMonth);
      expect(inside).toHaveLength(kislev.daysInMonth);
      expect(inside[0].date.day).toBe(1);
      expect(inside[0].date.calendarId).toBe("hebrew");
      expect(inside.every((cell) => cell.date.monthCode === kislev.monthCode)).toBe(true);
      expect(d.formatMonth(kislev, "en-US")).toMatch(/Kislev.*5787/u);
    });

    test("weekday names, labels and numbers", () => {
      const us = d.weekdayNames("en-US", "short", undefined);
      expect(us.map((name) => name.label)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
      expect(us[0]).toEqual({ dayOfWeek: 7, label: "Sun", name: "Sunday" });
      expect(
        d
          .weekdayNames("en-GB", "narrow", undefined)
          .map((name) => name.label)
          .join(""),
      ).toBe("MTWTFSS");
      expect(d.weekdayNames("en-US", "long", 1)[0].label).toBe("Monday");
      expect(d.formatMonth(month("2026-11"), "en-US")).toBe("November 2026");
      expect(d.formatMonth(day("2026-11-17"), "de-DE")).toBe("November 2026");
      // An ISO value is shown as Gregorian, so the label matches the grid (not the Buddhist year 2569).
      expect(d.formatMonth(month("2026-11"), "th-TH")).toContain("2026");
      expect(d.formatDayLabel(day("2026-11-17"), "en-US")).toBe("Tuesday, November 17, 2026");
      expect(d.formatDayNumber(day("2026-11-17"), "ar-EG")).toBe("١٧");
      expect(d.formatDayNumber(day("2026-11-17").withCalendar("hebrew"), "en-US")).toBe("7");
      expect(d.formatDate(day("2026-11-17"), "en-US", undefined)).toBe("Nov 17, 2026");
      expect(d.formatDate(undefined, "en-US", "full")).toBe("");
      expect(d.formatTime(time("13:45:30"), "en-US", undefined, undefined)).toBe("1:45 PM");
      expect(d.formatTime(time("13:45:30"), "en-US", "second", 24)).toBe("13:45:30");
      expect(d.formatTime(undefined, "en-US", undefined, undefined)).toBe("");
    });

    test("month and year options", () => {
      const months = d.monthOptions(month("2026-11"), "en-US", day("2026-03-15"), day("2026-11-30"));
      expect(months.map((option) => option.label).slice(0, 3)).toEqual(["January", "February", "March"]);
      expect(months.map((option) => option.disabled)).toEqual([
        true,
        true,
        ...Array.from({ length: 9 }, () => false),
        true,
      ]);
      expect(months[10].key).toBe("2026-11");
      // 5787 is a Hebrew leap year: thirteen months.
      const hebrew = d.monthOptions(
        day("2026-11-17").withCalendar("hebrew").toPlainYearMonth(),
        "en-US",
        undefined,
        undefined,
      );
      expect(hebrew).toHaveLength(13);
      const years = d.yearOptions(month("2026-11"), "en-US", undefined, undefined);
      expect(years).toHaveLength(21);
      expect(years[0].label).toBe("2016");
      expect(years[10].value.toString()).toBe("2026-11");
      const bounded = d.yearOptions(month("2026-11"), "en-US", day("2025-06-01"), day("2027-02-01"));
      expect(bounded.map((option) => option.label)).toEqual(["2025", "2026", "2027"]);
      expect(bounded.every((option) => !option.disabled)).toBe(true);
    });
  });

  describe("keyboard movement", () => {
    test("keys to moves, mirrored in right-to-left", () => {
      expect(d.dateMoveForKey("ArrowRight", false, false)).toBe("next-day");
      expect(d.dateMoveForKey("ArrowRight", false, true)).toBe("previous-day");
      expect(d.dateMoveForKey("ArrowUp", false, false)).toBe("previous-week");
      expect(d.dateMoveForKey("PageDown", false, false)).toBe("next-month");
      expect(d.dateMoveForKey("PageUp", true, false)).toBe("previous-year");
      expect(d.dateMoveForKey("Home", false, false)).toBe("start-of-week");
      expect(d.dateMoveForKey("a", false, false)).toBeUndefined();
    });

    test("each move", () => {
      const from = day("2026-11-17");
      const move = (m: Parameters<Core["moveDate"]>[1], options?: Parameters<Core["moveDate"]>[2]) =>
        d.moveDate(from, m, options ?? { locale: "en-US" }).toString();
      expect(move("next-day")).toBe("2026-11-18");
      expect(move("previous-day")).toBe("2026-11-16");
      expect(move("next-week")).toBe("2026-11-24");
      expect(move("previous-week")).toBe("2026-11-10");
      expect(move("next-month")).toBe("2026-12-17");
      expect(move("previous-year")).toBe("2025-11-17");
      expect(move("start-of-week")).toBe("2026-11-15");
      expect(move("end-of-week")).toBe("2026-11-21");
      expect(move("start-of-week", { locale: "en-GB" })).toBe("2026-11-16");
      expect(move("end-of-week", { locale: "ar-EG" })).toBe("2026-11-20");
      expect(d.moveDate(day("2026-01-31"), "next-month", undefined).toString()).toBe("2026-02-28");
    });

    test("stops at min and max, skips disabled days", () => {
      expect(d.moveDate(day("2026-11-20"), "next-day", { isDisabled: weekend }).toString()).toBe(
        "2026-11-23",
      );
      expect(d.moveDate(day("2026-11-23"), "previous-day", { isDisabled: weekend }).toString()).toBe(
        "2026-11-20",
      );
      expect(d.moveDate(day("2026-11-17"), "next-month", { max: day("2026-11-30") }).toString()).toBe(
        "2026-11-30",
      );
      expect(d.moveDate(day("2026-11-30"), "next-day", { max: day("2026-11-30") }).toString()).toBe(
        "2026-11-30",
      );
      // Saturday 21st is the week's end in en-US; disabled, so focus goes back to Friday.
      expect(
        d.moveDate(day("2026-11-17"), "end-of-week", { locale: "en-US", isDisabled: weekend }).toString(),
      ).toBe("2026-11-20");
      expect(d.moveDate(day("2026-11-17"), "next-day", { isDisabled: () => true }).toString()).toBe(
        "2026-11-17",
      );
      expect(
        d.moveDate(day("2026-11-28"), "next-day", { max: day("2026-11-29"), isDisabled: weekend }).toString(),
      ).toBe("2026-11-28");
      // Cut short by max (Saturday 28th, disabled): back to Friday 27th, not left on the 17th.
      expect(
        d
          .moveDate(day("2026-11-17"), "next-month", { max: day("2026-11-28"), isDisabled: weekend })
          .toString(),
      ).toBe("2026-11-27");
    });

    test("the day that takes focus when the grid is entered", () => {
      const november = month("2026-11");
      expect(d.defaultFocusDate(november, day("2026-11-17"), day("2026-11-02"), undefined).toString()).toBe(
        "2026-11-17",
      );
      expect(d.defaultFocusDate(november, day("2026-10-17"), day("2026-11-02"), undefined).toString()).toBe(
        "2026-11-02",
      );
      expect(d.defaultFocusDate(november, undefined, undefined, { isDisabled: weekend }).toString()).toBe(
        "2026-11-02",
      );
      expect(d.defaultFocusDate(november, undefined, undefined, { min: day("2026-11-10") }).toString()).toBe(
        "2026-11-10",
      );
      expect(d.defaultFocusDate(november, undefined, undefined, { isDisabled: () => true }).toString()).toBe(
        "2026-11-01",
      );
    });
  });

  describe("ranges", () => {
    test("normalise, in, start, end", () => {
      const range = d.normalizeRange(day("2026-11-20"), day("2026-11-10"));
      expect(keys([range?.start, range?.end])).toEqual(["2026-11-10", "2026-11-20"]);
      expect(d.normalizeRange(day("2026-11-20"), undefined)).toBeUndefined();
      expect(d.isInRange(day("2026-11-10"), range)).toBe(true);
      expect(d.isInRange(day("2026-11-21"), range)).toBe(false);
      expect(d.isInRange(day("2026-11-15"), undefined)).toBe(false);
      expect(d.isRangeStart(day("2026-11-10"), range)).toBe(true);
      expect(d.isRangeEnd(day("2026-11-10"), range)).toBe(false);
      expect(d.isRangeEnd(undefined, range)).toBe(false);
    });

    test("preview while selecting, unavailable days within", () => {
      const range = d.normalizeRange(day("2026-11-01"), day("2026-11-03"));
      expect(d.previewRange(undefined, day("2026-11-20"), range)).toBe(range);
      const preview = d.previewRange(day("2026-11-17"), day("2026-11-12"), range);
      expect(keys([preview?.start, preview?.end])).toEqual(["2026-11-12", "2026-11-17"]);
      const alone = d.previewRange(day("2026-11-17"), undefined, undefined);
      expect(keys([alone?.start, alone?.end])).toEqual(["2026-11-17", "2026-11-17"]);
      expect(
        d.rangeHasDisabledDate(d.normalizeRange(day("2026-11-16"), day("2026-11-20")), {
          isDisabled: weekend,
        }),
      ).toBe(false);
      expect(
        d.rangeHasDisabledDate(d.normalizeRange(day("2026-11-16"), day("2026-11-23")), {
          isDisabled: weekend,
        }),
      ).toBe(true);
      expect(d.rangeHasDisabledDate(range, { max: day("2026-11-02") })).toBe(true);
      expect(d.rangeHasDisabledDate(undefined, { isDisabled: weekend })).toBe(false);
    });
  });

  describe("form strings", () => {
    test("parse, tolerant of bad input", () => {
      expect(d.parseDate("2026-11-17", undefined)?.toString()).toBe("2026-11-17");
      expect(d.parseDate(" 2026-11-17 ", "hebrew")?.day).toBe(7);
      for (const bad of ["", "nope", "2026-13-01", "2026-02-30", null, undefined]) {
        expect(d.parseDate(bad, undefined)).toBeUndefined();
      }
      expect(d.parseTime("13:45")?.toString()).toBe("13:45:00");
      expect(d.parseTime("25:00")).toBeUndefined();
      expect(d.parseTime("")).toBeUndefined();
      expect(d.parseYearMonth("2026-11")?.toString()).toBe("2026-11");
      expect(d.parseYearMonth("2026-11-17")?.toString()).toBe("2026-11");
      expect(d.parseYearMonth("x")).toBeUndefined();
    });

    test("format for a hidden input", () => {
      expect(d.dateToString(day("2026-11-17"))).toBe("2026-11-17");
      expect(d.dateToString(day("2026-11-17").withCalendar("hebrew"))).toBe("2026-11-17");
      expect(d.dateToString(undefined)).toBe("");
      expect(d.timeToString(time("13:45"), undefined)).toBe("13:45:00");
      expect(d.timeToString(time("13:45:30"), "minute")).toBe("13:45");
      expect(d.timeToString(time("13:45:30"), "hour")).toBe("13:00");
      expect(d.timeToString(undefined, "second")).toBe("");
    });
  });

  describe("hour cycle and time lists", () => {
    test("hour cycle from the locale, with an override", () => {
      expect(d.hourCycleOf("en-US", undefined)).toBe("h12");
      expect(d.hourCycleOf("en-GB", undefined)).toBe("h23");
      expect(d.hourCycleOf("en-GB", 12)).toBe("h12");
      expect(d.hourCycleOf("en-US", 24)).toBe("h23");
      expect(d.hourCycleOf("ja-JP", 12)).toBe("h11");
    });

    test("hours, minutes, seconds and day periods", () => {
      const am = d.hourOptions("en-US", undefined, undefined);
      expect(am.map((option) => option.label)).toEqual([
        "12",
        ...Array.from({ length: 11 }, (_, i) => String(i + 1)),
      ]);
      expect(am.map((option) => option.value)).toEqual(Array.from({ length: 12 }, (_, i) => i));
      expect(d.hourOptions("en-US", undefined, 1).map((option) => option.value)[0]).toBe(12);
      const day24 = d.hourOptions("en-GB", undefined, undefined);
      expect(day24).toHaveLength(24);
      // temporal-polyfill shows a 24-hour hour in en-GB with one digit; the engines show two.
      expect(day24[9]).toEqual({ value: 9, label: engine === "native" ? "09" : "9" });
      expect(d.hourOptions("ja-JP", 12, 1)[0]).toEqual({ value: 12, label: "0" });
      expect(d.minuteOptions("en-US", 15)).toEqual([
        { value: 0, label: "00" },
        { value: 15, label: "15" },
        { value: 30, label: "30" },
        { value: 45, label: "45" },
      ]);
      expect(d.secondOptions("en-US", undefined)).toHaveLength(60);
      expect(d.minuteOptions("ar-EG", 30)[0].label).toBe("٠٠");
      expect(d.dayPeriodOptions("en-US")).toEqual([
        { value: 0, label: "AM" },
        { value: 1, label: "PM" },
      ]);
      expect(d.dayPeriodOptions("ko-KR").map((option) => option.label)).toEqual(["오전", "오후"]);
      expect(d.withDayPeriod(time("09:30"), 1)?.toString()).toBe("21:30:00");
      expect(d.withDayPeriod(time("12:30"), 0)?.toString()).toBe("00:30:00");
      expect(d.withDayPeriod(undefined, 1)).toBeUndefined();
    });
  });

  describe("segmented field", () => {
    const timeField = { type: "time", locale: "en-US" } as const;

    test("segments in the locale's order", () => {
      expect(kinds(d.fieldSegments({}, dateField()))).toBe("month/day/year");
      expect(kinds(d.fieldSegments({}, { ...dateField(), locale: "de-DE" }))).toBe("day.month.year");
      expect(kinds(d.fieldSegments({}, { ...dateField(), locale: "ja-JP" }))).toBe("year/month/day");
      expect(kinds(d.fieldSegments({}, timeField))).toBe("hour:minute dayPeriod");
      expect(kinds(d.fieldSegments({}, { ...timeField, locale: "ko-KR" }))).toBe("dayPeriod hour:minute");
      expect(kinds(d.fieldSegments({}, { ...timeField, locale: "en-GB", granularity: "second" }))).toBe(
        "hour:minute:second",
      );
      expect(kinds(d.fieldSegments({}, { ...timeField, hourCycle: 24, granularity: "hour" }))).toBe("hour");
    });

    test("text, placeholder, bounds, labels", () => {
      const empty = d.fieldSegments({}, dateField());
      expect(empty.map((segment) => segment.text).join("")).toBe("––/––/––––");
      expect(empty[0]).toMatchObject({
        kind: "month",
        value: undefined,
        min: 1,
        max: 12,
        editable: true,
        label: "month",
      });
      expect(empty[0].valueText).toBeUndefined();
      expect(empty[1]).toMatchObject({ kind: "literal", editable: false });
      const filled = d.fieldSegments(d.dateToSegments(day("2026-11-17"), undefined), dateField());
      expect(filled.map((segment) => segment.text).join("")).toBe("11/17/2026");
      expect(filled[0].valueText).toBe("11 – November");
      expect(filled[2].max).toBe(30);
      const arabic = d.fieldSegments(d.dateToSegments(day("2026-11-07"), undefined), {
        ...dateField(),
        locale: "ar-EG",
      });
      expect(arabic.find((segment) => segment.kind === "day")?.text).toBe("٧");
      const gb = d.fieldSegments({ hour: 9, minute: 5 }, { ...timeField, locale: "en-GB" });
      expect(gb.map((segment) => segment.text).join("")).toBe(engine === "native" ? "09:05" : "9:05");
      expect(d.fieldSegments({}, { ...timeField, locale: "de-DE" })[0].label).toBe("Stunde");
    });

    test("12-hour time shows the hour on the clock face", () => {
      const midnight = d.fieldSegments(d.timeToSegments(time("00:30")), timeField);
      expect(midnight.map((segment) => segment.text).join("")).toBe("12:30 AM");
      expect(midnight[0]).toMatchObject({ value: 12, min: 1, max: 12 });
      expect(
        d
          .fieldSegments(d.timeToSegments(time("13:05")), timeField)
          .map((s) => s.text)
          .join(""),
      ).toBe("1:05 PM");
      expect(
        d
          .fieldSegments({ hour: 0 }, { ...timeField, locale: "ja-JP", hourCycle: 12 })
          .find((s) => s.kind === "hour"),
      ).toMatchObject({
        value: 0,
        min: 0,
        max: 11,
      });
    });

    test("a Hebrew date field counts in its calendar", () => {
      const options = { type: "date", locale: "en-US", calendar: "hebrew" } as const;
      const values = d.dateToSegments(day("2026-11-17"), "hebrew");
      expect(values).toEqual({ year: 5787, month: 3, day: 7 });
      const segments = d.fieldSegments(values, options);
      expect(segments.find((segment) => segment.kind === "month")?.max).toBe(13);
      expect(d.segmentsToDate(values, options)?.withCalendar("iso8601").toString()).toBe("2026-11-17");
      // With the year empty, a month has as many months to choose from as any nearby year.
      expect(d.fieldSegments({}, options).find((segment) => segment.kind === "month")?.max).toBe(13);
    });

    test("stepping wraps, clamps the day, starts from the placeholder", () => {
      expect(d.incrementSegment({ month: 12 }, "month", 1, dateField()).month).toBe(1);
      expect(d.incrementSegment({ month: 1 }, "month", -1, dateField()).month).toBe(12);
      expect(d.incrementSegment({ year: 2026, month: 1, day: 31 }, "month", 1, dateField())).toEqual({
        year: 2026,
        month: 2,
        day: 28,
      });
      expect(d.incrementSegment({ year: 2024, month: 2, day: 29 }, "year", 1, dateField()).day).toBe(28);
      expect(d.incrementSegment({ year: 9999 }, "year", 1, dateField()).year).toBe(9999);
      expect(d.incrementSegment({ year: 2026, month: 2, day: 28 }, "day", 1, dateField()).day).toBe(1);
      expect(d.incrementSegment({}, "year", 1, dateField()).year).toBe(2026);
      expect(d.incrementSegment({}, "day", -1, dateField()).day).toBe(17);
      expect(d.incrementSegment({ minute: 59 }, "minute", 1, timeField).minute).toBe(0);
      expect(d.incrementSegment({ minute: 10 }, "minute", -15, timeField).minute).toBe(55);
      // 11 AM up is 12 AM: a 12-hour hour keeps its day period.
      expect(d.incrementSegment({ hour: 11, dayPeriod: 0 }, "hour", 1, timeField).hour).toBe(0);
      expect(d.incrementSegment({ hour: 23, dayPeriod: 1 }, "hour", 1, timeField).hour).toBe(12);
      expect(d.incrementSegment({ hour: 9, dayPeriod: 0 }, "dayPeriod", 1, timeField)).toEqual({
        hour: 21,
        dayPeriod: 1,
      });
      expect(d.incrementSegment({}, "hour", 1, timeField).hour).toBe(0);
      expect(
        d.incrementSegment({}, "dayPeriod", 1, { ...timeField, placeholderValue: time("15:00") }).dayPeriod,
      ).toBe(1);
      expect(d.setSegment({ year: 2026, day: 31 }, "month", 4, dateField())).toEqual({
        year: 2026,
        month: 4,
        day: 30,
      });
    });

    test("typing digits", () => {
      const type = (
        kind: Parameters<Core["typeIntoSegment"]>[1],
        typed: string,
        values = {},
        options: FieldOptions = dateField(),
      ) => {
        let entry = { values: values as Parameters<Core["typeIntoSegment"]>[0], buffer: "", advance: false };
        const steps: [number | undefined, boolean][] = [];
        for (const key of typed) {
          entry = d.typeIntoSegment(entry.values, kind, entry.buffer, key, options);
          steps.push([entry.values[kind], entry.advance]);
        }
        return steps;
      };
      expect(type("month", "12")).toEqual([
        [1, false],
        [12, true],
      ]);
      expect(type("month", "3")).toEqual([[3, true]]);
      expect(type("month", "05")).toEqual([
        [undefined, false],
        [5, true],
      ]);
      expect(type("day", "31")).toEqual([
        [3, false],
        [31, true],
      ]);
      expect(type("day", "4", { year: 2026, month: 2 })).toEqual([[4, true]]);
      expect(type("year", "2026").map(([, advance]) => advance)).toEqual([false, false, false, true]);
      expect(type("year", "2026").at(-1)?.[0]).toBe(2026);
      // A digit that would pass the maximum starts the number over.
      expect(type("month", "19")).toEqual([
        [1, false],
        [9, true],
      ]);
      expect(type("month", "٧", {}, { ...dateField(), locale: "ar-EG" })).toEqual([[7, true]]);
      expect(d.typeIntoSegment({ month: 4 }, "month", "", "x", dateField())).toEqual({
        values: { month: 4 },
        buffer: "",
        advance: false,
      });
      // 12-hour time: "1" may become 10–12; "12" is 12 AM, hour 0.
      expect(type("hour", "12", {}, timeField)).toEqual([
        [1, false],
        [0, true],
      ]);
      expect(type("hour", "09", { dayPeriod: 1 }, timeField)).toEqual([
        [undefined, false],
        [21, true],
      ]);
      expect(d.typeIntoSegment({ hour: 9 }, "dayPeriod", "", "p", timeField)).toEqual({
        values: { hour: 21, dayPeriod: 1 },
        buffer: "",
        advance: true,
      });
      expect(d.typeIntoSegment({ hour: 21, dayPeriod: 1 }, "dayPeriod", "", "A", timeField).values.hour).toBe(
        9,
      );
    });

    test("typing clamps the day once the month or year is finished", () => {
      const options = dateField();
      let entry = d.typeIntoSegment({ year: 2026, day: 31 }, "month", "", "0", options);
      entry = d.typeIntoSegment(entry.values, "month", entry.buffer, "4", options);
      expect(entry.values).toEqual({ year: 2026, month: 4, day: 30 });
      let year = {
        values: { month: 2, day: 29 } as Parameters<Core["typeIntoSegment"]>[0],
        buffer: "",
        advance: false,
      };
      const seen: (number | undefined)[] = [];
      for (const key of "2025") {
        year = d.typeIntoSegment(year.values, "year", year.buffer, key, options);
        seen.push(year.values.day);
      }
      expect(seen).toEqual([29, 29, 29, 28]);
    });

    test("clear and backspace", () => {
      expect(d.clearSegment({ year: 2026, month: 11 }, "month")).toEqual({ year: 2026, month: undefined });
      expect(d.backspaceSegment({ year: 2026 }, "year", dateField()).year).toBe(202);
      expect(d.backspaceSegment({ month: 1 }, "month", dateField()).month).toBeUndefined();
      expect(d.backspaceSegment({ month: 11 }, "month", dateField()).month).toBe(1);
      // 12 AM (hour 0) loses its 2: 1 AM.
      expect(d.backspaceSegment({ hour: 0, dayPeriod: 0 }, "hour", timeField).hour).toBe(1);
      expect(d.backspaceSegment({ minute: 10 }, "minute", timeField).minute).toBe(1);
      expect(d.backspaceSegment({ dayPeriod: 1 }, "dayPeriod", timeField).dayPeriod).toBeUndefined();
    });

    test("assembling a value", () => {
      expect(d.segmentsToDate({ year: 2026, month: 11, day: 17 }, dateField())?.toString()).toBe(
        "2026-11-17",
      );
      expect(d.segmentsToDate({ year: 2026, month: 11 }, dateField())).toBeUndefined();
      expect(d.segmentsToDate({ year: 2026, month: 2, day: 30 }, dateField())).toBeUndefined();
      expect(d.dateToSegments(undefined, undefined)).toEqual({});
      expect(d.timeToSegments(time("13:45:10"))).toEqual({ hour: 13, minute: 45, second: 10, dayPeriod: 1 });
      expect(d.segmentsToTime({ hour: 13, minute: 45, dayPeriod: 1 }, timeField)?.toString()).toBe(
        "13:45:00",
      );
      expect(d.segmentsToTime({ hour: 13, minute: 45 }, timeField)).toBeUndefined();
      expect(d.segmentsToTime({ hour: 13, minute: 45 }, { ...timeField, hourCycle: 24 })?.toString()).toBe(
        "13:45:00",
      );
      expect(d.segmentsToTime({ hour: 13 }, { ...timeField, hourCycle: 24 })).toBeUndefined();
      expect(
        d.segmentsToTime({ hour: 13 }, { ...timeField, hourCycle: 24, granularity: "hour" })?.toString(),
      ).toBe("13:00:00");
      expect(
        d.segmentsToTime({ hour: 13, minute: 5 }, { ...timeField, hourCycle: 24, granularity: "second" }),
      ).toBeUndefined();
    });
  });
});

describe("holding a Temporal value in .rx", () => {
  test("a boxed source, a prop, a grid and a disabled predicate", async () => {
    const { getByTestId, getByRole, container, user } = mount(holding);
    expect(getByTestId("label").textContent).toBe("Friday, November 20, 2026");
    expect(getByTestId("2026-11-20").hasAttribute("data-selected")).toBe(true);
    const cell = getByTestId("2026-11-23");
    await user.click(getByRole("button", { name: "Next weekday" }));
    expect(getByTestId("label").textContent).toBe("Monday, November 23, 2026");
    expect(container.querySelector("output")?.textContent).toBe("2026-11-23");
    expect(getByTestId("2026-11-20").hasAttribute("data-selected")).toBe(false);
    // Keyed rows (`weeks key key`, `days key key`) keep each day's element across a recomputed grid.
    expect(getByTestId("2026-11-23")).toBe(cell);
    expect(getByTestId("2026-11-23").hasAttribute("data-selected")).toBe(true);
  });

  // ReactiveScript 0.3.1 puts an object seed in a store, whose proxy breaks Temporal's methods. When this test
  // fails, the runtime has changed: simplify the holding rule in ../date.d.rx.
  test("a source seeded with a Temporal value throws", () => {
    expect(mount(bareSource).container.textContent).toMatch(/^failed: .*incompatible receiver/u);
  });
});
