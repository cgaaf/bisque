// What the date core relies on from each engine, natively: Temporal, Temporal values in Intl.DateTimeFormat,
// and Intl.Locale#getWeekInfo. No polyfill is loaded here (src/test/browser-setup.ts loads none), so a failure
// means the engine lacks the feature. date.test.ts covers the logic; this checks it holds in real engines.
import { expect, test } from "vitest";
import { mount } from "../../test/browser.ts";
import holding from "../fixtures/date.rx";
import {
  fieldSegments,
  formatDayLabel,
  formatTime,
  monthGrid,
  parseDate,
  parseYearMonth,
  weekInfo,
  weekdayNames,
} from "./date.ts";

test("Temporal and getWeekInfo are native", () => {
  expect(typeof globalThis.Temporal).toBe("object");
  expect(typeof (Intl.Locale.prototype as { getWeekInfo?: unknown }).getWeekInfo).toBe("function");
  expect(weekInfo("en-US").firstDay).toBe(7);
  expect(weekInfo("en-GB").firstDay).toBe(1);
  expect(weekInfo("ar-EG").firstDay).toBe(6);
});

test("formats and lays out Temporal values", () => {
  const november = parseYearMonth("2026-11")!;
  expect(monthGrid(november, { locale: "en-GB" })[0].days[0].key).toBe("2026-10-26");
  expect(weekdayNames("en-US", "short", undefined)[0].label).toBe("Sun");
  expect(formatDayLabel(parseDate("2026-11-17", undefined)!, "en-US")).toBe("Tuesday, November 17, 2026");
  expect(formatTime(Temporal.PlainTime.from("13:45"), "en-US", undefined, undefined)).toBe("1:45 PM");
  const hebrew = parseDate("2026-11-17", "hebrew")!;
  expect(
    monthGrid(hebrew.toPlainYearMonth(), { locale: "en-US" })
      .flatMap((week) => week.days)
      .filter((day) => !day.outsideMonth),
  ).toHaveLength(hebrew.daysInMonth);
  const kinds = fieldSegments({}, { type: "time", locale: "ko-KR" }).map((segment) => segment.kind);
  expect(kinds).toEqual(["dayPeriod", "literal", "hour", "literal", "minute"]);
});

test("an .rx part holds a Temporal value in a boxed source", async () => {
  const { getByTestId, getByRole, user } = mount(holding);
  expect(getByTestId("label").textContent).toBe("Friday, November 20, 2026");
  const cell = getByTestId("2026-11-23");
  await user.click(getByRole("button", { name: "Next weekday" }));
  expect(getByTestId("label").textContent).toBe("Monday, November 23, 2026");
  expect(getByTestId("2026-11-23").hasAttribute("data-selected")).toBe(true);
  expect(getByTestId("2026-11-23")).toBe(cell);
});
