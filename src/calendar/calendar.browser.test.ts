// Calendar and RangeCalendar in Chromium, Firefox and WebKit: focus, the keyboard, pointer input, paging, ranges,
// right to left, several months, forms and composing a picker in a popover. Today is pinned to 2030-05-15 in every
// fixture, so nothing depends on the clock.
import { within } from "@testing-library/dom";
import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";
import custom from "./fixtures/custom.rx";
import field from "./fixtures/field.rx";
import form from "./fixtures/form.rx";
import options from "./fixtures/options.rx";
import picker from "./fixtures/picker.rx";
import range from "./fixtures/range.rx";

// The in-month button of a day, inside `root` (another grid may show the same day outside its month).
function dayIn(root: ParentNode, iso: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(
    `button[data-date="${iso}"]:not([data-outside-month])`,
  );
  if (!button) throw new Error(`no day ${iso}`);
  return button;
}
const day = (iso: string) => dayIn(document, iso);
const tabStops = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLButtonElement>("button[data-date]")].filter(
    (button) => button.tabIndex === 0,
  );
const rootOf = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;

test("a month grid: weekday headers, labelled days, today and the selected day, one Tab stop", () => {
  const { getByRole, getAllByRole, getByTestId } = mount(basic);
  const grid = getByRole("grid", { name: "May 2030" });
  expect(grid.tagName).toBe("TABLE");
  expect(getByTestId("label").textContent).toBe("May 2030");
  expect(getByTestId("label").getAttribute("aria-live")).toBe("polite");
  const headers = getAllByRole("columnheader");
  expect(headers).toHaveLength(7);
  expect(headers[0].getAttribute("aria-label")).toBe("Sunday");
  expect(headers[0].textContent).toBe("Sun");
  // May 2030 starts on a Wednesday: five rows, the first with three days of April.
  expect(within(grid).getAllByRole("row")).toHaveLength(6);
  const today = getByRole("button", { name: "Wednesday, May 15, 2030" });
  expect(today.getAttribute("aria-current")).toBe("date");
  expect(today.hasAttribute("data-today")).toBe(true);
  expect(today.textContent).toBe("15");
  const selected = day("2030-05-20");
  expect(selected.hasAttribute("data-selected")).toBe(true);
  expect(selected.closest("td")?.getAttribute("aria-selected")).toBe("true");
  expect(day("2030-05-21").closest("td")?.getAttribute("aria-selected")).toBe("false");
  expect(tabStops(grid)).toEqual([selected]);
  expect(day("2030-05-18").hasAttribute("data-weekend")).toBe(true);
  // A day of April that fills the first row: shown, but disabled and hidden.
  const outside = grid.querySelector<HTMLButtonElement>('button[data-date="2030-04-28"]')!;
  expect(outside.hasAttribute("data-outside-month")).toBe(true);
  expect(outside.disabled).toBe(true);
  expect(outside.getAttribute("aria-hidden")).toBe("true");
  expect(outside.closest("td")?.hasAttribute("aria-selected")).toBe(false);
  expect(getAllByRole("gridcell").length).toBeGreaterThanOrEqual(31);
});

test("a press selects a day, tells the owner, and makes it the Tab stop", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  await user.click(day("2030-05-08"));
  expect(day("2030-05-08").hasAttribute("data-selected")).toBe(true);
  expect(day("2030-05-20").hasAttribute("data-selected")).toBe(false);
  expect(getByTestId("picked").textContent).toBe("2030-05-08");
  expect(getByTestId("completed").textContent).toBe("1");
  expect(tabStops(getByRole("grid"))).toEqual([day("2030-05-08")]);
  // The same day again changes nothing, but completes a selection (a picker closes on it).
  await user.click(day("2030-05-08"));
  expect(getByTestId("picked").textContent).toBe("2030-05-08");
  expect(getByTestId("completed").textContent).toBe("2");
});

test("arrow keys move by day and week, keeping each day's element (cell identity)", async () => {
  const { user } = mount(basic);
  const start = day("2030-05-20");
  const next = day("2030-05-21");
  const below = day("2030-05-28");
  start.focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(next);
  expect(next.tabIndex).toBe(0);
  expect(start.tabIndex).toBe(-1);
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(below);
  await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowUp}{ArrowUp}");
  expect(document.activeElement).toBe(day("2030-05-12"));
  // Moves within the month render nothing new: these are the same elements.
  expect(day("2030-05-20")).toBe(start);
  expect(day("2030-05-21")).toBe(next);
  expect(day("2030-05-28")).toBe(below);
  // Nothing was selected by moving.
  expect(start.hasAttribute("data-selected")).toBe(true);
});

test("Home and End go to the week's start and end; Enter and Space select", async () => {
  const { getByTestId, user } = mount(basic);
  day("2030-05-20").focus();
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(day("2030-05-19"));
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(day("2030-05-25"));
  await user.keyboard("{Enter}");
  expect(getByTestId("picked").textContent).toBe("2030-05-25");
  await user.keyboard("{ArrowLeft}");
  await user.keyboard(" ");
  expect(getByTestId("picked").textContent).toBe("2030-05-24");
  expect(day("2030-05-24").hasAttribute("data-selected")).toBe(true);
});

test("moving past the month turns the page and keeps focus on the new day", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  day("2030-05-29").focus();
  await user.keyboard("{ArrowDown}");
  await frame();
  expect(getByTestId("label").textContent).toBe("June 2030");
  expect(getByRole("grid").getAttribute("aria-label")).toBe("June 2030");
  expect(document.activeElement).toBe(day("2030-06-05"));
  await user.keyboard("{ArrowUp}");
  await frame();
  expect(getByTestId("label").textContent).toBe("May 2030");
  expect(document.activeElement).toBe(day("2030-05-29"));
  // A month boundary by day: the first, then back one day.
  day("2030-05-01").focus();
  await user.keyboard("{ArrowLeft}");
  await frame();
  expect(getByTestId("label").textContent).toBe("April 2030");
  expect(document.activeElement).toBe(day("2030-04-30"));
});

test("PageUp and PageDown move by month; with Shift by year", async () => {
  const { getByTestId, user } = mount(basic);
  day("2030-05-31").focus();
  await user.keyboard("{PageDown}");
  await frame();
  expect(getByTestId("label").textContent).toBe("June 2030");
  // May 31 has no June equivalent: the last day of June.
  expect(document.activeElement).toBe(day("2030-06-30"));
  await user.keyboard("{PageUp}");
  await frame();
  expect(document.activeElement).toBe(day("2030-05-30"));
  await user.keyboard("{Shift>}{PageDown}{/Shift}");
  await frame();
  expect(getByTestId("label").textContent).toBe("May 2031");
  expect(document.activeElement).toBe(day("2031-05-30"));
  await user.keyboard("{Shift>}{PageUp}{/Shift}");
  await frame();
  expect(document.activeElement).toBe(day("2030-05-30"));
});

test("the previous and next buttons turn the month; the Tab stop falls back to the first day", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  await user.click(getByRole("button", { name: "Next month" }));
  expect(getByTestId("label").textContent).toBe("June 2030");
  // Neither the selected day nor today is in June: its first day is the Tab stop.
  expect(tabStops(getByRole("grid"))).toEqual([day("2030-06-01")]);
  await user.click(getByRole("button", { name: "Previous month" }));
  await user.click(getByRole("button", { name: "Previous month" }));
  expect(getByTestId("label").textContent).toBe("April 2030");
  await user.click(getByRole("button", { name: "Next month" }));
  expect(tabStops(getByRole("grid"))).toEqual([day("2030-05-20")]);
  // Four turns in a row.
  const next = getByRole("button", { name: "Next month" });
  await user.click(next);
  await user.click(next);
  await user.click(next);
  await user.click(next);
  expect(getByTestId("label").textContent).toBe("September 2030");
});

test("Tab enters the grid on its one Tab stop and leaves it in one step", async () => {
  const { getByRole, user } = mount(basic);
  getByRole("button", { name: "Next month" }).focus();
  await user.keyboard("{Tab}");
  expect(document.activeElement).toBe(day("2030-05-20"));
});

test("min and max: days outside are disabled, focus stops at them, the buttons stop", async () => {
  const { user } = mount(options);
  const de = rootOf("de");
  expect(dayIn(de, "2030-05-05").disabled).toBe(true);
  expect(dayIn(de, "2030-05-05").hasAttribute("data-disabled")).toBe(true);
  expect(dayIn(de, "2030-05-06").disabled).toBe(false);
  const previous = within(de).getByRole("button", { name: "Previous month" });
  expect((previous as HTMLButtonElement).disabled).toBe(true);
  // Today (the 15th) is the Tab stop; Monday the 6th is the earliest day.
  dayIn(de, "2030-05-15").focus();
  await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
  expect(document.activeElement).toBe(dayIn(de, "2030-05-06"));
  await user.keyboard("{PageUp}");
  expect(document.activeElement).toBe(dayIn(de, "2030-05-06"));
  expect(within(de).getByTestId("de-label").textContent).toBe("Mai 2030");
  await user.click(within(de).getByRole("button", { name: "Next month" }));
  expect(within(de).getByTestId("de-label").textContent).toBe("Juni 2030");
  expect((within(de).getByRole("button", { name: "Next month" }) as HTMLButtonElement).disabled).toBe(true);
  expect(dayIn(de, "2030-06-21").disabled).toBe(true);
});

test("unavailable days are focusable and announced, but not selectable", async () => {
  const { user } = mount(options);
  const de = rootOf("de");
  const saturday = dayIn(de, "2030-05-11");
  expect(saturday.disabled).toBe(false);
  expect(saturday.getAttribute("aria-disabled")).toBe("true");
  expect(saturday.hasAttribute("data-unavailable")).toBe(true);
  dayIn(de, "2030-05-10").focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(saturday);
  await user.keyboard("{Enter}");
  expect(saturday.hasAttribute("data-selected")).toBe(false);
  // Playwright won't press an `aria-disabled` element unless forced.
  await user.click(saturday, { force: true });
  expect(saturday.hasAttribute("data-selected")).toBe(false);
  await user.click(dayIn(de, "2030-05-10"));
  expect(dayIn(de, "2030-05-10").hasAttribute("data-selected")).toBe(true);
});

test("a locale whose week starts on Monday, and one on Sunday", () => {
  mount(options);
  const de = within(rootOf("de"));
  // With week numbers, the first column header is the week's.
  const deHeaders = de.getAllByRole("columnheader");
  expect(deHeaders[0].getAttribute("aria-label")).toBe("Woche");
  expect(deHeaders[1].getAttribute("aria-label")).toBe("Montag");
  expect(deHeaders[7].getAttribute("aria-label")).toBe("Sonntag");
  expect(de.getAllByRole("rowheader")[0].getAttribute("aria-label")).toBe("Woche 18");
  // Wednesday the 1st is in the third column of the first row.
  const deFirstRow = de.getAllByRole("row")[1];
  expect(deFirstRow.querySelectorAll("button")[2].getAttribute("data-date")).toBe("2030-05-01");
  const us = within(rootOf("us"));
  const usHeaders = us.getAllByRole("columnheader");
  expect(usHeaders[0].getAttribute("aria-label")).toBe("Sunday");
  expect(usHeaders[0].textContent).toBe("Sunday");
  expect(us.getAllByRole("row")[1].querySelectorAll("button")[3].getAttribute("data-date")).toBe(
    "2030-05-01",
  );
  // `fixedWeeks`: six rows of days whatever the month.
  expect(us.getAllByRole("row")).toHaveLength(7);
  expect(
    within(rootOf("months")).getAllByRole("grid")[0].querySelector("th")?.getAttribute("aria-label"),
  ).toBe("Sunday");
});

test("right to left: ArrowLeft moves to the next day, ArrowRight to the previous", async () => {
  const { user } = mount(options);
  const rtl = rootOf("rtl");
  dayIn(rtl, "2030-05-15").focus();
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(dayIn(rtl, "2030-05-16"));
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(document.activeElement).toBe(dayIn(rtl, "2030-05-14"));
});

test("month and year selects show and set the visible month, disabling what is out of range", async () => {
  const { user } = mount(options);
  const us = rootOf("us");
  const month = within(us).getByTestId("us-month") as HTMLSelectElement;
  const year = within(us).getByTestId("us-year") as HTMLSelectElement;
  expect(month.getAttribute("aria-label")).toBe("Month");
  expect(month.selectedOptions[0].textContent).toBe("May");
  expect(year.selectedOptions[0].textContent).toBe("2030");
  await user.selectOptions(month, "2030-09");
  expect(within(us).getByTestId("us-label").textContent).toBe("September 2030");
  await user.selectOptions(year, "2031-09");
  expect(within(us).getByTestId("us-label").textContent).toBe("September 2031");
  // August 2031 is the last month with a day in range.
  const august = [...month.options].find((option) => option.value === "2031-08")!;
  expect(august.disabled).toBe(false);
  const september = [...month.options].find((option) => option.value === "2031-09")!;
  expect(september.disabled).toBe(true);
  expect([...year.options].map((option) => option.textContent)).toEqual(["2028", "2029", "2030", "2031"]);
});

test("several months: side by side, paging together, focus crossing between grids", async () => {
  const { user } = mount(options);
  const months = rootOf("months");
  const grids = within(months).getAllByRole("grid");
  expect(grids.map((grid) => grid.getAttribute("aria-label"))).toEqual(["May 2030", "June 2030"]);
  expect(within(months).getByTestId("months-label-1").textContent).toBe("June 2030");
  // One Tab stop across both grids: today.
  expect(tabStops(months)).toEqual([dayIn(months, "2030-05-15")]);
  dayIn(months, "2030-05-29").focus();
  await user.keyboard("{ArrowDown}");
  // Into the second grid, without turning the page.
  expect(document.activeElement).toBe(dayIn(months, "2030-06-05"));
  expect(within(months).getAllByRole("grid")[0].getAttribute("aria-label")).toBe("May 2030");
  await user.keyboard("{PageDown}");
  await frame();
  // Past the last visible month: a whole page turns.
  expect(
    within(months)
      .getAllByRole("grid")
      .map((grid) => grid.getAttribute("aria-label")),
  ).toEqual(["July 2030", "August 2030"]);
  expect(document.activeElement).toBe(dayIn(months, "2030-07-05"));
  await user.click(within(months).getByRole("button", { name: "Previous month" }));
  expect(
    within(months)
      .getAllByRole("grid")
      .map((grid) => grid.getAttribute("aria-label")),
  ).toEqual(["May 2030", "June 2030"]);
});

test("range by pointer: first press anchors, hover previews, second press completes", async () => {
  const { getByTestId, user } = mount(range);
  const stay = rootOf("label").closest<HTMLElement>("[role=group]")!;
  await user.click(dayIn(stay, "2030-05-05"));
  expect(getByTestId("pending").textContent).toBe("pending");
  expect(dayIn(stay, "2030-05-05").hasAttribute("data-range-start")).toBe(true);
  await user.hover(dayIn(stay, "2030-05-08"));
  expect(dayIn(stay, "2030-05-06").hasAttribute("data-range-preview")).toBe(true);
  expect(dayIn(stay, "2030-05-06").hasAttribute("data-range-middle")).toBe(true);
  expect(dayIn(stay, "2030-05-08").hasAttribute("data-range-end")).toBe(true);
  expect(dayIn(stay, "2030-05-09").hasAttribute("data-selected")).toBe(false);
  expect(getByTestId("picked").textContent).toBe("");
  await user.click(dayIn(stay, "2030-05-08"));
  expect(getByTestId("picked").textContent).toBe("2030-05-05/2030-05-08");
  expect(getByTestId("completed").textContent).toBe("1");
  expect(getByTestId("pending").textContent).toBe("");
  expect(dayIn(stay, "2030-05-06").hasAttribute("data-range-preview")).toBe(false);
  expect(dayIn(stay, "2030-05-06").hasAttribute("data-selected")).toBe(true);
  expect(dayIn(stay, "2030-05-06").closest("td")?.getAttribute("aria-selected")).toBe("true");
  expect(stay.querySelector("table")?.getAttribute("aria-multiselectable")).toBe("true");
  // Backwards: the second press may come before the first.
  await user.click(dayIn(stay, "2030-05-12"));
  await user.click(dayIn(stay, "2030-05-10"));
  expect(getByTestId("picked").textContent).toBe("2030-05-10/2030-05-12");
  // Escape right after a press cancels the range under way (WebKit doesn't focus a pressed button).
  await user.click(dayIn(stay, "2030-05-20"));
  expect(getByTestId("pending").textContent).toBe("pending");
  await user.keyboard("{Escape}");
  expect(getByTestId("pending").textContent).toBe("");
  expect(dayIn(stay, "2030-05-20").hasAttribute("data-range-start")).toBe(false);
  // And the arrow keys carry on from the pressed day.
  await user.click(dayIn(stay, "2030-05-20"));
  await user.keyboard("{ArrowRight}{Enter}");
  expect(getByTestId("picked").textContent).toBe("2030-05-20/2030-05-21");
});

test("range by keyboard: Enter anchors, arrows preview, Enter completes; Escape cancels", async () => {
  const { getByTestId, user } = mount(range);
  const stay = rootOf("label").closest<HTMLElement>("[role=group]")!;
  dayIn(stay, "2030-05-15").focus();
  await user.keyboard("{Enter}");
  expect(getByTestId("pending").textContent).toBe("pending");
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(dayIn(stay, "2030-05-16").hasAttribute("data-range-preview")).toBe(true);
  expect(dayIn(stay, "2030-05-17").hasAttribute("data-range-end")).toBe(true);
  await user.keyboard("{Escape}");
  expect(getByTestId("pending").textContent).toBe("");
  expect(dayIn(stay, "2030-05-16").hasAttribute("data-selected")).toBe(false);
  expect(getByTestId("picked").textContent).toBe("");
  await user.keyboard("{Enter}{ArrowDown}{Enter}");
  expect(getByTestId("picked").textContent).toBe("2030-05-17/2030-05-24");
  // Across a month: anchored in May, completed in June (before the 13th, which is booked).
  await user.keyboard("{Enter}{PageDown}");
  await frame();
  expect(getByTestId("label").textContent).toBe("June 2030");
  await user.keyboard("{ArrowUp}{ArrowUp}{Enter}");
  expect(getByTestId("picked").textContent).toBe("2030-05-24/2030-06-10");
});

test("a range across an unavailable day can't be completed, unless allowed", async () => {
  const { getByTestId, user } = mount(range);
  const stay = rootOf("label").closest<HTMLElement>("[role=group]")!;
  await user.click(dayIn(stay, "2030-05-10"));
  await user.hover(dayIn(stay, "2030-05-16"));
  // The preview stops at its first day: the 13th and 14th are booked.
  expect(dayIn(stay, "2030-05-11").hasAttribute("data-range-preview")).toBe(false);
  await user.click(dayIn(stay, "2030-05-16"));
  expect(getByTestId("picked").textContent).toBe("");
  expect(getByTestId("pending").textContent).toBe("pending");
  await user.click(dayIn(stay, "2030-05-12"));
  expect(getByTestId("picked").textContent).toBe("2030-05-10/2030-05-12");
  // An unavailable day can't start a range either.
  await user.click(dayIn(stay, "2030-05-13"), { force: true });
  expect(getByTestId("pending").textContent).toBe("");
  const loose = rootOf("loose");
  await user.click(dayIn(loose, "2030-05-10"));
  await user.click(dayIn(loose, "2030-05-16"));
  expect(getByTestId("loose-picked").textContent).toBe("2030-05-10/2030-05-16");
});

test("controlled: follows its value and month; an owner that keeps its value keeps the selection", async () => {
  const { getByTestId, getByRole, user } = mount(controlled);
  const owned = rootOf("owned");
  expect(dayIn(owned, "2030-05-09").hasAttribute("data-selected")).toBe(true);
  await user.click(dayIn(owned, "2030-05-12"));
  expect(getByTestId("value").textContent).toBe("2030-05-12");
  expect(dayIn(owned, "2030-05-12").hasAttribute("data-selected")).toBe(true);
  await user.click(getByRole("button", { name: "Set 22nd" }));
  expect(dayIn(owned, "2030-05-22").hasAttribute("data-selected")).toBe(true);
  expect(dayIn(owned, "2030-05-12").hasAttribute("data-selected")).toBe(false);
  await user.click(within(owned).getByRole("button", { name: "Next month" }));
  expect(getByTestId("month").textContent).toBe("2030-06");
  expect(getByTestId("owned-label").textContent).toBe("June 2030");
  await user.click(getByRole("button", { name: "Show August" }));
  expect(getByTestId("owned-label").textContent).toBe("August 2030");
  await user.click(getByRole("button", { name: "Keep" }));
  await user.click(dayIn(owned, "2030-08-07"));
  expect(getByTestId("asked").textContent).toBe("2030-08-07");
  expect(getByTestId("value").textContent).toBe("2030-05-22");
  expect(dayIn(owned, "2030-08-07").hasAttribute("data-selected")).toBe(false);
});

test("disabled: no day can be focused or selected, the buttons are disabled; focus comes back after", async () => {
  const { getByRole, user } = mount(controlled);
  const disabled = rootOf("disabled");
  const selected = dayIn(disabled, "2030-05-09");
  selected.focus();
  expect(document.activeElement).toBe(selected);
  await user.click(getByRole("button", { name: "Toggle disabled" }));
  expect(selected.disabled).toBe(true);
  expect(disabled.hasAttribute("data-disabled")).toBe(true);
  expect(within(disabled).getByRole("grid").getAttribute("aria-disabled")).toBe("true");
  expect(tabStops(disabled)).toEqual([]);
  expect((within(disabled).getByRole("button", { name: "Next month" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  // Focus coming back to a re-enabled day is covered by calendar.async.browser.test.ts.
  selected.focus();
  await user.click(getByRole("button", { name: "Toggle disabled" }));
  expect(selected.disabled).toBe(false);
  expect(selected.hasAttribute("data-selected")).toBe(true);
});

test("read-only: days can be focused and moved between, not selected", async () => {
  const { user } = mount(controlled);
  const readonly = rootOf("readonly");
  expect(within(readonly).getByRole("grid").getAttribute("aria-readonly")).toBe("true");
  dayIn(readonly, "2030-05-09").focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(dayIn(readonly, "2030-05-10"));
  await user.keyboard("{Enter}");
  await user.click(dayIn(readonly, "2030-05-12"));
  expect(dayIn(readonly, "2030-05-09").hasAttribute("data-selected")).toBe(true);
  expect(dayIn(readonly, "2030-05-12").hasAttribute("data-selected")).toBe(false);
});

test("forms: a day submits its ISO string, a range two entries; a reset restores the defaults", async () => {
  const { getByTestId, getByRole, user } = mount(form);
  const formElement = getByTestId("form") as HTMLFormElement;
  const data = () => Object.fromEntries(new FormData(formElement).entries());
  expect(data()).toEqual({
    day: "2030-05-20",
    arrive: "2030-05-03",
    leave: "2030-05-05",
    "trip-start": "",
    "trip-end": "",
    fixed: "2030-05-09",
  });
  await user.click(dayIn(rootOf("day"), "2030-05-02"));
  await user.click(dayIn(rootOf("stay"), "2030-05-10"));
  await user.click(dayIn(rootOf("stay"), "2030-05-07"));
  await user.click(dayIn(rootOf("trip"), "2030-05-21"));
  await user.click(dayIn(rootOf("trip"), "2030-05-22"));
  await user.click(dayIn(rootOf("controlled"), "2030-05-30"));
  expect(data()).toEqual({
    day: "2030-05-02",
    arrive: "2030-05-07",
    leave: "2030-05-10",
    "trip-start": "2030-05-21",
    "trip-end": "2030-05-22",
    fixed: "2030-05-30",
  });
  expect(getByTestId("changes").textContent).toBe("1");
  await user.click(getByRole("button", { name: "Reset" }));
  await frame();
  // Uncontrolled ones go back to their defaults (reported once); the controlled one keeps its owner's value.
  expect(data()).toEqual({
    day: "2030-05-20",
    arrive: "2030-05-03",
    leave: "2030-05-05",
    "trip-start": "",
    "trip-end": "",
    fixed: "2030-05-30",
  });
  expect(dayIn(rootOf("day"), "2030-05-20").hasAttribute("data-selected")).toBe(true);
  expect(dayIn(rootOf("stay"), "2030-05-04").hasAttribute("data-range-middle")).toBe(true);
  expect(dayIn(rootOf("trip"), "2030-05-21").hasAttribute("data-selected")).toBe(false);
  expect(getByTestId("changes").textContent).toBe("2");
  // A controlled "nothing": `null`.
  await user.click(getByRole("button", { name: "Clear" }));
  expect(data().fixed).toBe("");
  expect(dayIn(rootOf("controlled"), "2030-05-30").hasAttribute("data-selected")).toBe(false);
});

test("inside a field: labelled by it, validated when required, submitted under its name", async () => {
  const { getByTestId, getByRole, getAllByRole, user } = mount(field);
  const group = getByRole("group", { name: "Due date" });
  expect(group.contains(getAllByRole("grid")[0])).toBe(true);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("due-error").textContent).toBe("Choose a date");
  expect(getByTestId("submitted").textContent).toBe("");
  await user.click(dayIn(group, "2030-05-21"));
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("due=2030-05-21");
  // The disabled field disables its calendar.
  const locked = getByRole("group", { name: "Locked" });
  expect(locked.hasAttribute("data-disabled")).toBe(true);
  expect(tabStops(locked)).toEqual([]);
});

test("autoFocus: turning true focuses the selected range's start, paging to it, and drops a half-chosen range", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  const opening = rootOf("opening");
  const toggle = getByRole("button", { name: "Toggle open" });
  // Nothing selected: the Tab stop (today).
  await user.click(toggle);
  await expect.poll(() => document.activeElement).toBe(dayIn(opening, "2030-05-15"));
  // A range left half-chosen while "open".
  await user.keyboard("{ArrowRight}{Enter}{ArrowRight}");
  expect(opening.hasAttribute("data-pending")).toBe(true);
  await user.click(toggle);
  // The owner picks a range in another month while "closed"; opening again shows and focuses its start.
  await user.click(getByRole("button", { name: "Pick July" }));
  await user.click(toggle);
  await expect.poll(() => document.activeElement).toBe(dayIn(opening, "2030-07-08"));
  expect(getByTestId("opening-label").textContent).toBe("July 2030");
  expect(opening.hasAttribute("data-pending")).toBe(false);
});

test("rendering the rows yourself: keyed rows, week numbers, a day with children and a custom part", async () => {
  const { getByTestId, getAllByRole, user } = mount(custom);
  expect(getAllByRole("rowheader")[0].textContent).toBe("18");
  const selected = day("2030-05-20");
  expect(selected.textContent).toBe("20•");
  expect(getByTestId("dot-2030-05-21").textContent).toBe("");
  selected.focus();
  const next = day("2030-05-21");
  await user.keyboard("{ArrowRight}{ArrowRight}{ArrowLeft}{ArrowLeft}{ArrowRight}");
  expect(document.activeElement).toBe(next);
  expect(day("2030-05-21")).toBe(next);
  await user.keyboard("{Enter}");
  expect(getByTestId("dot-2030-05-21").textContent).toBe("•");
  await user.keyboard("{PageDown}");
  await frame();
  expect(getByTestId("label").textContent).toBe("June 2030");
  expect(document.activeElement).toBe(day("2030-06-21"));
});

// Popover with a controlled `open`, opened and closed twice in one test, reports UNSTABLE_MEMO_OUTPUT from
// PopoverPopup with nothing but a button inside (a Popover issue): each test here opens it once.
test("in a popover: opening focuses the range's start; Escape cancels a range first; completing closes", async () => {
  const { getByRole, getByTestId, user } = mount(picker);
  const trigger = getByRole("button", { name: "Dates" });
  trigger.focus();
  await user.keyboard("{Enter}");
  const popup = document.querySelector<HTMLElement>("[popover]")!;
  await expect.poll(() => popup.matches(":popover-open")).toBe(true);
  await expect.poll(() => document.activeElement).toBe(day("2030-05-08"));
  await user.keyboard("{ArrowRight}{Enter}{ArrowRight}");
  expect(day("2030-05-10").hasAttribute("data-range-preview")).toBe(true);
  // The first Escape cancels the range under way and leaves the popup open.
  await user.keyboard("{Escape}");
  await frame();
  expect(popup.matches(":popover-open")).toBe(true);
  expect(day("2030-05-10").hasAttribute("data-range-preview")).toBe(false);
  expect(day("2030-05-08").hasAttribute("data-range-start")).toBe(true);
  // Completing a range closes it.
  await user.keyboard("{Enter}{ArrowDown}{Enter}");
  await expect.poll(() => popup.matches(":popover-open")).toBe(false);
  expect(getByTestId("picked").textContent).toBe("2030-05-10/2030-05-17");
});

test("in a popover: with no range under way, Escape closes it", async () => {
  const { getByRole, user } = mount(picker);
  getByRole("button", { name: "Dates" }).focus();
  await user.keyboard("{Enter}");
  const popup = document.querySelector<HTMLElement>("[popover]")!;
  await expect.poll(() => document.activeElement).toBe(day("2030-05-08"));
  await user.keyboard("{ArrowRight}{Escape}");
  await expect.poll(() => popup.matches(":popover-open")).toBe(false);
});
