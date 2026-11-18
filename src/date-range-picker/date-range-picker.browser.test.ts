// Date Range Picker in Chromium, Firefox and WebKit (fixtures/*.rx). Today is pinned to 2030-05-15 in every fixture.
import { within } from "@testing-library/dom";
import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import fieldFixture from "./fixtures/field.rx";
import options from "./fixtures/options.rx";

const shown = (popup: HTMLElement) => popup.matches(":popover-open");

function segments(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("[role=spinbutton]"));
}

function text(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-bisque-segment]"))
    .map((s) => s.textContent)
    .join("");
}

const day = (iso: string, scope: ParentNode = document) =>
  scope.querySelector<HTMLButtonElement>(`button[data-date="${iso}"]:not([data-outside-month])`)!;

function setup() {
  const mounted = mount(basic);
  const group = mounted.getByTestId("group");
  const start = mounted.getByTestId("start");
  const end = mounted.getByTestId("end");
  const popup = mounted.getByTestId("popup");
  const trigger = mounted.getByRole("button", { name: "Calendar Stay" });
  const form = mounted.getByTestId("form") as HTMLFormElement;
  const input = (name: string) => form.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  const changes = () => mounted.getByTestId("changes").textContent;
  return { ...mounted, group, start, end, popup, trigger, form, input, changes };
}

test("one labelled group holds a start and an end field and the trigger; the popup is named by it", () => {
  const { group, start, end, popup, trigger, getByRole } = setup();
  expect(group.getAttribute("role")).toBe("group");
  // Nothing but the segments, the separator and the trigger's content: the parts the picker adds render no text.
  expect(group.textContent).toBe(`${text(start)}–${text(end)}▾`);
  expect(getByRole("group", { name: "Stay" })).toBe(group);
  expect(within(group).getByRole("group", { name: "Start date" })).toBe(start);
  expect(within(group).getByRole("group", { name: "End date" })).toBe(end);
  expect(within(group).getByRole("spinbutton", { name: "Start date month" })).toBe(segments(start)[0]);
  expect(group.querySelector(":scope > [aria-hidden=true]")?.textContent).toBe("–");
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  expect(popup.getAttribute("role")).toBe("dialog");
  expect(popup.getAttribute("aria-labelledby")).toBe(group.id);
});

test("picking a range fills both fields, closes and focuses the trigger; Escape cancels a range first", async () => {
  const { popup, trigger, start, end, changes, user } = setup();
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => shown(popup)).toBe(true);
  await expect.poll(() => document.activeElement).toBe(day("2030-05-15"));
  await user.keyboard("{Enter}{ArrowRight}{ArrowRight}");
  expect(day("2030-05-16").hasAttribute("data-range-preview")).toBe(true);
  // The first Escape cancels the range under way and leaves the popup open.
  await user.keyboard("{Escape}");
  await frame();
  expect(shown(popup)).toBe(true);
  await user.keyboard("{Enter}{ArrowDown}{Enter}");
  await expect.poll(() => shown(popup)).toBe(false);
  expect(document.activeElement).toBe(trigger);
  expect(text(start)).toBe("5/17/2030");
  expect(text(end)).toBe("5/24/2030");
  expect(changes()).toBe("2030-05-17/2030-05-24");
  // Again: opening focuses the range's start; a press outside closes it.
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(day("2030-05-17"));
  expect(day("2030-05-20").hasAttribute("data-range-middle")).toBe(true);
  await user.keyboard("{Escape}");
  await expect.poll(() => shown(popup)).toBe(false);
  expect(document.activeElement).toBe(trigger);
  await user.click(trigger);
  await expect.poll(() => shown(popup)).toBe(true);
  await user.click(day("2030-05-01"));
  await user.click(day("2030-05-03"));
  await expect.poll(() => shown(popup)).toBe(false);
  expect(document.activeElement).toBe(trigger);
  expect(changes()).toBe("2030-05-17/2030-05-24 2030-05-01/2030-05-03");
});

test("the popup is placed under the group, lined up with its start", async () => {
  const { popup, trigger, group, user } = setup();
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => shown(popup)).toBe(true);
  await frame();
  const placed = popup.getBoundingClientRect();
  const anchor = group.getBoundingClientRect();
  expect(placed.top).toBeGreaterThanOrEqual(anchor.bottom - 1);
  expect(Math.abs(placed.left - anchor.left)).toBeLessThan(2);
  await user.keyboard("{Escape}");
});

test("Escape after opening with a press closes and leaves focus on the trigger", async () => {
  const { popup, trigger, user } = setup();
  await user.click(trigger);
  await expect.poll(() => shown(popup)).toBe(true);
  await expect.poll(() => document.activeElement).toBe(day("2030-05-15"));
  await user.keyboard("{Escape}");
  await expect.poll(() => shown(popup)).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

test("typing both fields updates the calendar's range and month; the range is reported when both are complete", async () => {
  const { popup, trigger, start, end, changes, getByTestId, user } = setup();
  await user.click(segments(start)[0]);
  await user.keyboard("08012030");
  expect(changes()).toBe("");
  // Tab goes on from the start's year to the end field.
  await user.keyboard("{Tab}");
  expect(document.activeElement).toBe(segments(end)[0]);
  await user.keyboard("08052030");
  // Each year digit makes a complete end, so each is reported, as the field reports it.
  expect(changes()).toBe(
    "2030-08-01/0002-08-05 2030-08-01/0020-08-05 2030-08-01/0203-08-05 2030-08-01/2030-08-05",
  );
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => shown(popup)).toBe(true);
  await expect.poll(() => document.activeElement).toBe(day("2030-08-01"));
  expect(getByTestId("label").textContent).toBe("August 2030");
  expect(day("2030-08-01").hasAttribute("data-range-start")).toBe(true);
  expect(day("2030-08-05").hasAttribute("data-range-end")).toBe(true);
  await user.keyboard("{Escape}");
});

test("a start after the end is invalid, not swapped, and the calendar shows no range", async () => {
  const { popup, trigger, group, start, end, input, user } = setup();
  await user.click(segments(start)[0]);
  await user.keyboard("08102030");
  await user.click(segments(end)[0]);
  await user.keyboard("08052030");
  expect(text(start)).toBe("8/10/2030");
  expect(text(end)).toBe("8/5/2030");
  expect(group.hasAttribute("data-invalid")).toBe(true);
  expect(start.hasAttribute("data-invalid")).toBe(true);
  expect(input("stay-start").validationMessage).toBe("The end date is before the start date.");
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => shown(popup)).toBe(true);
  expect(popup.querySelectorAll("[data-selected]")).toHaveLength(0);
  await user.keyboard("{Escape}");
  await expect.poll(() => shown(popup)).toBe(false);
  // Fixing the end makes it valid.
  await user.click(segments(end)[1]);
  await user.keyboard("12");
  expect(group.hasAttribute("data-invalid")).toBe(false);
  expect(input("stay-start").validity.valid).toBe(true);
});

test("an end outside max, an unavailable end or a partial end makes the start input invalid too (for Field)", async () => {
  const { group, end, input, user } = setup();
  await user.click(segments(end)[0]);
  await user.keyboard("05");
  expect(group.hasAttribute("data-invalid")).toBe(true);
  expect(input("stay-end").validationMessage).toBe("Enter a complete date.");
  expect(input("stay-start").validationMessage).toBe("Enter a complete date.");
  await user.keyboard("132030");
  expect(input("stay-end").validationMessage).toBe("This date is unavailable.");
  expect(input("stay-start").validity.customError).toBe(true);
  const year = segments(end)[2];
  year.focus();
  await user.keyboard("{ArrowUp}");
  await user.keyboard("{ArrowLeft}{ArrowUp}");
  expect(text(end)).toBe("5/14/2031");
  expect(input("stay-end").validity.rangeOverflow).toBe(true);
  expect(input("stay-start").validity.customError).toBe(true);
  expect(input("stay-start").validationMessage).toBe(input("stay-end").validationMessage);
  await user.keyboard("{ArrowRight}{ArrowDown}");
  expect(input("stay-end").validity.valid).toBe(true);
  expect(input("stay-start").validity.valid).toBe(true);
});

test("the form submits <name>-start and <name>-end once each, and reset puts each default back", async () => {
  const { popup, trigger, start, end, form, getByRole, getByTestId, changes, user } = setup();
  const trip = getByTestId("trip");
  expect([...new FormData(form).entries()]).toEqual([
    ["stay-start", ""],
    ["stay-end", ""],
    ["trip-start", "2030-05-08"],
    ["trip-end", "2030-05-10"],
  ]);
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(day("2030-05-15"));
  await user.keyboard("{Enter}{ArrowRight}{Enter}");
  await expect.poll(() => shown(popup)).toBe(false);
  segments(trip)[4].focus();
  await user.keyboard("{ArrowUp}");
  expect([...new FormData(form).entries()]).toEqual([
    ["stay-start", "2030-05-15"],
    ["stay-end", "2030-05-16"],
    ["trip-start", "2030-05-08"],
    ["trip-end", "2030-05-11"],
  ]);
  await user.click(getByRole("button", { name: "Reset" }));
  await expect.poll(() => text(start)).toBe("––/––/––––");
  expect(text(end)).toBe("––/––/––––");
  expect(text(trip)).toBe("5/8/20305/10/2030");
  expect([...new FormData(form).entries()]).toEqual([
    ["stay-start", ""],
    ["stay-end", ""],
    ["trip-start", "2030-05-08"],
    ["trip-end", "2030-05-10"],
  ]);
  expect(changes()).toBe("2030-05-15/2030-05-16 none");
});

test("four ranges in a row, each from the keyboard, each closing and focusing the trigger", async () => {
  const { popup, trigger, changes, user } = setup();
  const picked: string[] = [];
  for (let i = 0; i < 4; i++) {
    trigger.focus();
    // oxlint-disable-next-line no-await-in-loop -- each step acts on what the one before left
    await user.keyboard("{Enter}");
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => shown(popup)).toBe(true);
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => document.activeElement).toBe(day(i == 0 ? "2030-05-15" : `2030-05-${15 + i}`));
    // oxlint-disable-next-line no-await-in-loop
    await user.keyboard("{ArrowRight}{Enter}{ArrowRight}{Enter}");
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => document.activeElement).toBe(trigger);
    picked.push(`2030-05-${16 + i}/2030-05-${17 + i}`);
  }
  expect(changes()).toBe(picked.join(" "));
});

test("controlled: the owner's range is shown in the fields and the calendar, and set from outside", async () => {
  const { getByTestId, getByRole, user } = mount(options);
  const group = getByTestId("controlled");
  const popup = getByTestId("controlled-popup");
  expect(text(group)).toBe("5/8/20305/10/2030");
  await user.click(getByRole("button", { name: "Set July" }));
  expect(text(group)).toBe("7/1/20307/4/2030");
  const trigger = getByRole("button", { name: "Calendar Controlled" });
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(day("2030-07-01", popup));
  expect(getByTestId("open").textContent).toBe("open");
  await user.keyboard("{Enter}{ArrowDown}{Enter}");
  await expect.poll(() => shown(popup)).toBe(false);
  expect(getByTestId("chosen").textContent).toBe("2030-07-01/2030-07-08");
  expect(getByTestId("open").textContent).toBe("closed");
  await user.click(getByRole("button", { name: "Clear" }));
  expect(text(group)).toBe("––/––/––––––/––/––––");
});

test("controlled and empty: a start typed while the owner holds null stays, and the range is reported with the end", async () => {
  const { getByTestId, getByRole, user } = mount(options);
  const group = getByTestId("controlled");
  await user.click(getByRole("button", { name: "Clear" }));
  const [startMonth, , , endMonth] = segments(group);
  await user.click(startMonth);
  await user.keyboard("06012030");
  expect(text(group)).toBe("6/1/2030––/––/––––");
  expect(getByTestId("chosen").textContent).toBe("none");
  await user.click(endMonth);
  await user.keyboard("0603");
  expect(getByTestId("chosen").textContent).toBe("none");
  await user.keyboard("2030");
  expect(getByTestId("chosen").textContent).toBe("2030-06-01/2030-06-03");
  expect(text(group)).toBe("6/1/20306/3/2030");
});

test("controlled: emptying one side keeps the other, though the owner's value becomes null", async () => {
  const { getByTestId, user } = mount(options);
  const group = getByTestId("controlled");
  const endDay = segments(group)[4];
  await user.click(endDay);
  await user.keyboard("{Backspace}{Backspace}");
  expect(getByTestId("chosen").textContent).toBe("none");
  expect(text(group)).toBe("5/8/20305/––/2030");
  await user.keyboard("12");
  expect(getByTestId("chosen").textContent).toBe("2030-05-08/2030-05-12");
  expect(text(group)).toBe("5/8/20305/12/2030");
});

test("controlled: set and cleared from outside twice", async () => {
  const { getByTestId, getByRole, user } = mount(options);
  const group = getByTestId("controlled");
  for (let i = 0; i < 2; i++) {
    // oxlint-disable-next-line no-await-in-loop -- each press acts on the value the one before left
    await user.click(getByRole("button", { name: "Set July" }));
    expect(text(group)).toBe("7/1/20307/4/2030");
    // oxlint-disable-next-line no-await-in-loop
    await user.click(getByRole("button", { name: "Clear" }));
    expect(text(group)).toBe("––/––/––––––/––/––––");
  }
});

test("controlled open: an owner that refuses a close keeps the popup shown", async () => {
  const { getByTestId, getByRole, user } = mount(options);
  const popup = getByTestId("controlled-popup");
  await user.click(getByRole("button", { name: "Keep open" }));
  const trigger = getByRole("button", { name: "Calendar Controlled" });
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => shown(popup)).toBe(true);
  await expect.poll(() => document.activeElement).toBe(day("2030-05-08", popup));
  // Escape closes the browser's popover; the owner keeps `open` true, so it is shown again.
  await user.keyboard("{Escape}");
  await frame();
  await expect.poll(() => shown(popup)).toBe(true);
  expect(getByTestId("open").textContent).toBe("open");
  await user.click(document.body, { position: { x: 400, y: 5 } });
  await frame();
  await expect.poll(() => shown(popup)).toBe(true);
  expect(getByTestId("open").textContent).toBe("open");
});

test("controlled open: opened and closed from outside, twice", async () => {
  const { getByTestId, getByRole, user } = mount(options);
  const popup = getByTestId("controlled-popup");
  const toggle = getByRole("button", { name: "Toggle from outside" });
  for (let i = 0; i < 2; i++) {
    // oxlint-disable-next-line no-await-in-loop -- each step acts on what the one before left
    await user.click(toggle);
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => shown(popup)).toBe(true);
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => document.activeElement).toBe(day("2030-05-08", popup));
    // oxlint-disable-next-line no-await-in-loop
    await user.keyboard("{Escape}");
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => shown(popup)).toBe(false);
    expect(getByTestId("open").textContent).toBe("closed");
  }
});

test("disabled and read-only: the trigger is disabled and the popup can't open", () => {
  const { getByTestId, getByRole } = mount(options);
  expect(getByRole("button", { name: "Calendar Disabled" }).matches(":disabled")).toBe(true);
  expect(getByTestId("disabled").hasAttribute("data-disabled")).toBe(true);
  for (const segment of segments(getByTestId("disabled")))
    expect(segment.hasAttribute("contenteditable")).toBe(false);
  expect(getByRole("button", { name: "Calendar Read only" }).matches(":disabled")).toBe(true);
  for (const segment of segments(getByTestId("readonly")))
    expect(segment.getAttribute("aria-readonly")).toBe("true");
  expect(shown(getByTestId("disabled-popup"))).toBe(false);
});

test("closeOnSelect false: completing a range keeps the popup open", async () => {
  const { getByTestId, getByRole, user } = mount(options);
  const popup = getByTestId("stays-popup");
  getByRole("button", { name: "Calendar Stays open" }).focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(day("2030-05-08", popup));
  await user.keyboard("{ArrowRight}{Enter}{ArrowRight}{Enter}");
  await frame();
  expect(shown(popup)).toBe(true);
  expect(text(getByTestId("stays"))).toBe("5/9/20305/10/2030");
  await user.keyboard("{Escape}");
  await expect.poll(() => shown(popup)).toBe(false);
});

test("inside a Field: FieldLabel names the group, validated on submit, the Form gets { start, end }", async () => {
  const { getByRole, getByTestId, user } = mount(fieldFixture);
  const group = getByTestId("trip");
  expect(getByRole("group", { name: "Trip" })).toBe(group);
  expect(getByTestId("popup").getAttribute("aria-labelledby")).toBe(group.getAttribute("aria-labelledby"));
  expect(group.getAttribute("aria-describedby")).toBe(getByTestId("description").id);
  expect(document.querySelectorAll('input[name="trip-start"]')).toHaveLength(1);
  expect(document.querySelectorAll('input[name="trip-end"]')).toHaveLength(1);
  expect(document.querySelectorAll("input[name]")).toHaveLength(2);

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("");
  expect(group.hasAttribute("data-invalid")).toBe(true);
  expect(getByTestId("error").textContent).not.toBe("");
  // Both sides' segments are described by the Field's description and error, and invalid with it, though the
  // fields inside the picker don't see the FieldRoot.
  const described = `${getByTestId("description").id} ${getByTestId("error").id}`;
  expect(segments(group)).toHaveLength(6);
  for (const segment of segments(group)) {
    expect(segment.getAttribute("aria-describedby")).toBe(described);
    expect(segment.getAttribute("aria-invalid")).toBe("true");
  }

  const [startMonth, , , endMonth] = segments(group);
  await user.click(startMonth);
  await user.keyboard("06012030");
  await user.click(endMonth);
  await user.keyboard("06032031");
  await user.click(getByRole("button", { name: "Submit" }));
  // The end is beyond max: the start input carries it, so the Field is invalid.
  expect(getByTestId("submitted").textContent).toBe("");
  expect(group.hasAttribute("data-invalid")).toBe(true);

  const endYear = segments(group)[5];
  endYear.focus();
  await user.keyboard("{ArrowDown}");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("trip=2030-06-01/2030-06-03");
  expect(group.hasAttribute("data-invalid")).toBe(false);
});
