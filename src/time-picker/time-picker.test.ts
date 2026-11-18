// The pure part of Time Picker (../internal/impl/time-picker.ts): each column's options and which are disabled, the
// time a choice makes, the option a column opens on, and the interval list.
import { expect, test } from "vitest";
import {
  chooseInColumn,
  columnOptions,
  columnTarget,
  columnValue,
  intervalOptions,
  intervalTarget,
  isTwelveHour,
} from "../internal/impl/time-picker.ts";

const time = (text: string) => Temporal.PlainTime.from(text);
const settings = (min?: string, max?: string, step?: number) => ({
  locale: "en-US",
  hourCycle: undefined,
  step,
  min: min === undefined ? undefined : time(min),
  max: max === undefined ? undefined : time(max),
});
const values = (options: { value: string }[]) => options.map((option) => option.value);
const disabled = (options: { value: string; disabled: boolean }[]) =>
  options.filter((option) => option.disabled).map((option) => option.value);

test("the hour column lists the basis's day period in 12-hour time, all 24 hours in 24-hour time", () => {
  const morning = columnOptions("hour", time("09:30"), settings());
  expect(values(morning)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
  expect(morning.map((o) => o.label).slice(0, 2)).toEqual(["12", "1"]);
  expect(values(columnOptions("hour", time("21:30"), settings()))[0]).toBe("12");
  const h24 = columnOptions("hour", time("21:30"), { ...settings(), hourCycle: 24 as const });
  expect(h24.length).toBe(24);
  expect(isTwelveHour("en-US", undefined)).toBe(true);
  expect(isTwelveHour("en-GB", undefined)).toBe(false);
  expect(isTwelveHour("en-GB", 12)).toBe(true);
});

test("minutes and seconds every step; the day periods in the locale's words", () => {
  expect(values(columnOptions("minute", time("09:30"), settings(undefined, undefined, 15)))).toEqual([
    "0",
    "15",
    "30",
    "45",
  ]);
  expect(
    columnOptions("second", time("09:30"), settings(undefined, undefined, 20)).map((o) => o.label),
  ).toEqual(["00", "20", "40"]);
  expect(columnOptions("dayPeriod", time("09:30"), settings()).map((o) => o.label)).toEqual(["AM", "PM"]);
});

test("an option is disabled only when no time it makes is within min and max", () => {
  // 08:30–17:00: hour 8 has allowed minutes; hour 17 has only 17:00.
  const hours = columnOptions("hour", time("09:00"), {
    ...settings("08:30", "17:00"),
    hourCycle: 24 as const,
  });
  expect(disabled(hours)).toEqual([
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "18",
    "19",
    "20",
    "21",
    "22",
    "23",
  ]);
  expect(disabled(columnOptions("minute", time("08:00"), settings("08:30", "17:00", 15)))).toEqual([
    "0",
    "15",
  ]);
  expect(disabled(columnOptions("minute", time("17:00"), settings("08:30", "17:00", 15)))).toEqual([
    "15",
    "30",
    "45",
  ]);
  expect(disabled(columnOptions("dayPeriod", time("09:00"), settings("13:00")))).toEqual(["0"]);
  expect(disabled(columnOptions("dayPeriod", time("09:00"), settings(undefined, "11:00")))).toEqual(["1"]);
  expect(disabled(columnOptions("hour", time("09:00"), settings()))).toEqual([]);
});

test("a choice replaces one unit, truncates below the granularity and is clamped into the bounds", () => {
  expect(chooseInColumn(time("09:30"), "hour", "14", "minute", undefined, undefined)?.toString()).toBe(
    "14:30:00",
  );
  expect(chooseInColumn(time("09:30:15"), "minute", "45", "minute", undefined, undefined)?.toString()).toBe(
    "09:45:00",
  );
  expect(chooseInColumn(time("09:30:15"), "second", "40", "second", undefined, undefined)?.toString()).toBe(
    "09:30:40",
  );
  expect(chooseInColumn(time("09:30"), "dayPeriod", "1", "minute", undefined, undefined)?.toString()).toBe(
    "21:30:00",
  );
  expect(chooseInColumn(time("21:30"), "dayPeriod", "0", "minute", undefined, undefined)?.toString()).toBe(
    "09:30:00",
  );
  // From 10:15 with a minimum of 09:30, choosing hour 9 lands on 09:30, not on the disallowed 09:15.
  expect(chooseInColumn(time("10:15"), "hour", "9", "minute", time("09:30"), undefined)?.toString()).toBe(
    "09:30:00",
  );
  expect(chooseInColumn(time("10:15"), "hour", "x", "minute", undefined, undefined)).toBeUndefined();
});

test("the option a column opens on: the basis's unit, minutes and seconds rounded to the nearest step", () => {
  expect(columnValue(time("21:07"), "hour")).toBe("21");
  expect(columnValue(time("21:07"), "dayPeriod")).toBe("1");
  expect(columnTarget(time("09:07"), "minute", 15)).toBe("0");
  expect(columnTarget(time("09:08"), "minute", 15)).toBe("15");
  // Rounding up past the last option stays on the last.
  expect(columnTarget(time("09:58"), "minute", 15)).toBe("45");
  expect(columnTarget(time("09:07"), "minute", undefined)).toBe("7");
});

test("the interval list: whole times from midnight, out-of-range ones disabled, the value as a form submits it", () => {
  const list = intervalOptions("en-US", 30, "minute", undefined, time("09:00"), time("17:00"));
  expect(list.length).toBe(48);
  expect(list[19]).toEqual({ value: "09:30", label: "9:30 AM", disabled: false });
  expect(list[17].disabled).toBe(true);
  expect(list[34]).toEqual({ value: "17:00", label: "5:00 PM", disabled: false });
  expect(list[35].disabled).toBe(true);
  expect(intervalOptions("en-GB", 60, "second", undefined, undefined, undefined)[13].value).toBe("13:00:00");
  // At hour granularity only whole hours: 09:30 would submit as 09:00.
  expect(values(intervalOptions("en-US", 30, "hour", undefined, undefined, undefined)).slice(0, 2)).toEqual([
    "00:00",
    "01:00",
  ]);
  expect(intervalTarget(time("09:14"), 30, "minute")).toBe("09:00");
  expect(intervalTarget(time("09:16"), 30, "minute")).toBe("09:30");
  expect(intervalTarget(time("23:50"), 30, "minute")).toBe("23:30");
});
