// The calendar's paging and Tab stop maths (src/internal/impl/calendar.ts), and the structure a calendar renders,
// in jsdom. Keyboard, focus and pointer behaviour are in calendar.browser.test.ts.
import { expect, test } from "vitest";
import { isVisible, pageFor, tabStopDate, visibleMonths } from "../internal/impl/calendar.ts";
import { mount } from "../test/mount.ts";
import options from "./fixtures/options.rx";
import range from "./fixtures/range.rx";

const date = (iso: string) => Temporal.PlainDate.from(iso);
const month = (iso: string) => Temporal.PlainYearMonth.from(iso);

test("the visible months: as many as asked (at least one), labelled, keyed and placed", () => {
  const months = visibleMonths(month("2030-11"), 3, "en-US");
  expect(months.map((m) => [m.key, m.offset, m.label])).toEqual([
    ["2030-11", 0, "November 2030"],
    ["2030-12", 1, "December 2030"],
    ["2031-01", 2, "January 2031"],
  ]);
  expect(visibleMonths(month("2030-11"), 0, "en-US")).toHaveLength(1);
});

test("whether a day is visible across several months", () => {
  expect(isVisible(date("2030-12-31"), month("2030-11"), 2)).toBe(true);
  expect(isVisible(date("2031-01-01"), month("2030-11"), 2)).toBe(false);
  expect(isVisible(date("2030-10-31"), month("2030-11"), 2)).toBe(false);
  expect(isVisible(undefined, month("2030-11"), 2)).toBe(false);
});

test("the page that shows a day turns whole pages, either way and across years", () => {
  expect(pageFor(date("2030-11-20"), month("2030-11"), 1).toString()).toBe("2030-11");
  expect(pageFor(date("2030-12-01"), month("2030-11"), 1).toString()).toBe("2030-12");
  expect(pageFor(date("2030-12-01"), month("2030-11"), 2).toString()).toBe("2030-11");
  expect(pageFor(date("2031-01-01"), month("2030-11"), 2).toString()).toBe("2031-01");
  expect(pageFor(date("2030-10-31"), month("2030-11"), 2).toString()).toBe("2030-09");
  expect(pageFor(date("2032-02-10"), month("2030-11"), 3).toString()).toBe("2032-02");
});

test("the Tab stop: the focused day, the selected day, today, then the first available day", () => {
  const first = month("2030-11");
  const today = date("2030-11-17");
  const limits = { min: date("2030-11-05"), max: date("2031-02-20") };
  expect(tabStopDate(first, 1, date("2030-11-09"), date("2030-11-20"), today, limits).toString()).toBe(
    "2030-11-09",
  );
  // A focused day no longer visible, or out of bounds, is passed over.
  expect(tabStopDate(first, 1, date("2030-10-09"), date("2030-11-20"), today, limits).toString()).toBe(
    "2030-11-20",
  );
  expect(tabStopDate(first, 1, date("2030-11-02"), undefined, today, limits).toString()).toBe("2030-11-17");
  expect(tabStopDate(first, 1, undefined, undefined, undefined, limits).toString()).toBe("2030-11-05");
  // Several months: the selected day in the second.
  expect(tabStopDate(first, 2, undefined, date("2030-12-03"), today, limits).toString()).toBe("2030-12-03");
  // Neither in view: the first available day of the first month.
  expect(tabStopDate(month("2031-01"), 1, undefined, date("2030-12-03"), today, limits).toString()).toBe(
    "2031-01-01",
  );
});

test("weekday columns follow the locale, or `firstDayOfWeek`", () => {
  const { getByTestId } = mount(options);
  const headers = (id: string) =>
    [...getByTestId(id).querySelectorAll("thead th:not([data-week-number])")].map((th) =>
      th.getAttribute("aria-label"),
    );
  expect(headers("de")[0]).toBe("Montag");
  expect(headers("us")[0]).toBe("Sunday");
  // en-GB starts on Monday; the root is told Sunday.
  expect(headers("months")[0]).toBe("Sunday");
  expect(headers("months")).toHaveLength(14);
});

test("every day has its full name, its ISO key and the weekend hook", () => {
  const { getByTestId } = mount(options);
  const us = getByTestId("us");
  const saturday = us.querySelector('button[data-date="2030-05-18"]:not([data-outside-month])')!;
  expect(saturday.getAttribute("aria-label")).toBe("Saturday, May 18, 2030");
  expect(saturday.hasAttribute("data-weekend")).toBe(true);
  expect(us.querySelector('button[data-date="2030-05-17"]')?.hasAttribute("data-weekend")).toBe(false);
  const de = getByTestId("de");
  expect(de.querySelector('button[data-date="2030-05-15"]')?.getAttribute("aria-label")).toBe(
    "Mittwoch, 15. Mai 2030",
  );
  expect(de.querySelector('button[data-date="2030-05-15"]')?.getAttribute("aria-current")).toBe("date");
});

test("a range calendar's grid is multiselectable and has no selection to begin with", () => {
  const { getAllByRole } = mount(range);
  const grid = getAllByRole("grid")[0];
  expect(grid.getAttribute("aria-multiselectable")).toBe("true");
  expect(grid.querySelectorAll("[data-selected]")).toHaveLength(0);
});
