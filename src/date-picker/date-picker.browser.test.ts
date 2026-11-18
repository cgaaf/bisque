// Date Picker in Chromium, Firefox and WebKit (fixtures/*.rx). Today is pinned to 2030-05-15 in every fixture.
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

const day = (iso: string, within: ParentNode = document) =>
  within.querySelector<HTMLButtonElement>(`button[data-date="${iso}"]:not([data-outside-month])`)!;

function setup() {
  const mounted = mount(basic);
  const group = mounted.getByTestId("group");
  const popup = mounted.getByTestId("popup");
  const trigger = mounted.getByRole("button", { name: "Calendar Due date" });
  const changes = () => mounted.getByTestId("changes").textContent;
  return { ...mounted, group, popup, trigger, changes };
}

test("a labelled group holds the field and the trigger; the popup is a dialog named by it", () => {
  const { group, popup, trigger } = setup();
  expect(group.getAttribute("role")).toBe("group");
  // Nothing but the segments and the trigger's content: the parts the picker adds inside render no text.
  expect(group.textContent).toBe(`${text(group)}▾`);
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  expect(trigger.getAttribute("popovertarget")).toBe(popup.id);
  expect(popup.getAttribute("role")).toBe("dialog");
  expect(popup.getAttribute("aria-labelledby")).toBe(group.id);
  expect(shown(popup)).toBe(false);
});

test("opening focuses today; picking a day fills the field, closes and focuses the trigger", async () => {
  const { popup, trigger, group, changes, user } = setup();
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => shown(popup)).toBe(true);
  await expect.poll(() => document.activeElement).toBe(day("2030-05-15"));
  await user.keyboard("{ArrowRight}{Enter}");
  await expect.poll(() => shown(popup)).toBe(false);
  expect(document.activeElement).toBe(trigger);
  expect(text(group)).toBe("5/16/2030");
  expect(changes()).toBe("2030-05-16");
  // Again: opening focuses the selected day.
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(day("2030-05-16"));
  await user.keyboard("{Escape}");
  await expect.poll(() => shown(popup)).toBe(false);
  expect(document.activeElement).toBe(trigger);
  await user.click(trigger);
  await expect.poll(() => document.activeElement).toBe(day("2030-05-16"));
  await user.click(day("2030-05-20"));
  await expect.poll(() => shown(popup)).toBe(false);
  expect(document.activeElement).toBe(trigger);
  expect(changes()).toBe("2030-05-16 2030-05-20");
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

test("typing in the field updates the calendar's selection and month", async () => {
  const { popup, trigger, group, user } = setup();
  const [month] = segments(group);
  await user.click(month);
  await user.keyboard("08202030");
  expect(text(group)).toBe("8/20/2030");
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => shown(popup)).toBe(true);
  await expect.poll(() => document.activeElement).toBe(day("2030-08-20"));
  expect(day("2030-08-20").hasAttribute("data-selected")).toBe(true);
  await frame();
});

test("while open, typing a date turns the calendar's page to it; Shift+Tab leaves the popup open", async () => {
  const { popup, trigger, group, getByTestId, user } = setup();
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(day("2030-05-15"));
  const [month] = segments(group);
  month.focus();
  await user.keyboard("10052030");
  await frame();
  expect(shown(popup)).toBe(true);
  expect(getByTestId("label").textContent).toBe("October 2030");
  expect(day("2030-10-05").hasAttribute("data-selected")).toBe(true);
  // A date outside [min, max] is kept, and the page doesn't follow it.
  const [, , year] = segments(group);
  year.focus();
  await user.keyboard("2031");
  await frame();
  expect(text(group)).toBe("10/5/2031");
  expect(getByTestId("label").textContent).toBe("October 2030");
});

test("a date outside min/max, an unavailable day or a partial date is kept and invalid", async () => {
  const { group, getByTestId, user } = setup();
  const form = getByTestId("form") as HTMLFormElement;
  const input = form.querySelector<HTMLInputElement>('input[name="due"]')!;
  const [month, , year] = segments(group);
  await user.click(month);
  await user.keyboard("05");
  expect(group.hasAttribute("data-invalid")).toBe(true);
  expect(input.validationMessage).toBe("Enter a complete date.");
  await user.keyboard("132030");
  expect(text(group)).toBe("5/13/2030");
  expect(group.hasAttribute("data-invalid")).toBe(true);
  expect(group.getAttribute("aria-invalid")).toBe("true");
  expect(input.validity.customError).toBe(true);
  expect(input.validationMessage).toBe("This date is unavailable.");
  year.focus();
  await user.keyboard("2031");
  expect(text(group)).toBe("5/13/2031");
  await user.keyboard("{ArrowLeft}{ArrowUp}");
  expect(text(group)).toBe("5/14/2031");
  expect(input.validity.customError).toBe(false);
  expect(input.validity.rangeOverflow).toBe(true);
  expect(group.hasAttribute("data-invalid")).toBe(true);
  await user.keyboard("{ArrowRight}");
  await user.keyboard("2030");
  expect(input.validity.valid).toBe(true);
  expect(group.hasAttribute("data-invalid")).toBe(false);
});

test("an unavailable day can't be picked in the calendar", async () => {
  const { popup, trigger, changes, user } = setup();
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(day("2030-05-15"));
  expect(day("2030-05-13").getAttribute("aria-disabled")).toBe("true");
  await user.keyboard("{ArrowLeft}{ArrowLeft}{Enter}");
  await frame();
  expect(shown(popup)).toBe(true);
  expect(changes()).toBe("");
  await user.keyboard("{Escape}");
  await expect.poll(() => shown(popup)).toBe(false);
});

test("a press outside closes it; it reports each change of its open state", async () => {
  const { popup, trigger, getByTestId, user } = setup();
  await user.click(trigger);
  await expect.poll(() => shown(popup)).toBe(true);
  await user.click(document.body, { position: { x: 400, y: 5 } });
  await expect.poll(() => shown(popup)).toBe(false);
  await user.click(trigger);
  await expect.poll(() => shown(popup)).toBe(true);
  await user.click(trigger);
  await expect.poll(() => shown(popup)).toBe(false);
  await expect.poll(() => getByTestId("opens").textContent).toBe("open closed open closed");
});

test("the form submits one ISO date per picker, and reset puts each default back", async () => {
  const { group, getByTestId, getByRole, trigger, user } = setup();
  const form = getByTestId("form") as HTMLFormElement;
  expect([...new FormData(form).entries()]).toEqual([
    ["due", ""],
    ["start", "2030-05-08"],
  ]);
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(day("2030-05-15"));
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(trigger);
  const start = getByTestId("start");
  segments(start)[1].focus();
  await user.keyboard("{ArrowUp}");
  // One entry each: the field and the calendar inside a picker submit nothing of their own.
  expect([...new FormData(form).entries()]).toEqual([
    ["due", "2030-05-15"],
    ["start", "2030-05-09"],
  ]);
  await user.click(getByRole("button", { name: "Reset" }));
  // Each picker restores its value in its own task after the native reset.
  await expect.poll(() => [text(group), text(start)]).toEqual(["––/––/––––", "5/8/2030"]);
  expect([...new FormData(form).entries()]).toEqual([
    ["due", ""],
    ["start", "2030-05-08"],
  ]);
  expect(getByTestId("changes").textContent).toBe("2030-05-15 none");
});

test("controlled: the owner's value is shown in field and calendar, and set from outside", async () => {
  const { getByTestId, getByRole, user } = mount(options);
  const group = getByTestId("controlled");
  const popup = getByTestId("controlled-popup");
  expect(text(group)).toBe("5/8/2030");
  await user.click(getByRole("button", { name: "Set July 4" }));
  expect(text(group)).toBe("7/4/2030");
  const trigger = getByRole("button", { name: "Calendar Controlled" });
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(day("2030-07-04", popup));
  expect(getByTestId("open").textContent).toBe("open");
  await user.keyboard("{ArrowDown}{Enter}");
  await expect.poll(() => shown(popup)).toBe(false);
  expect(getByTestId("chosen").textContent).toBe("2030-07-11");
  expect(getByTestId("open").textContent).toBe("closed");
  await user.click(getByRole("button", { name: "Clear" }));
  expect(text(group)).toBe("––/––/––––");
});

test("controlled: set and cleared from outside twice", async () => {
  const { getByTestId, getByRole, user } = mount(options);
  const group = getByTestId("controlled");
  for (let i = 0; i < 2; i++) {
    // oxlint-disable-next-line no-await-in-loop -- each press acts on the value the one before left
    await user.click(getByRole("button", { name: "Set July 4" }));
    expect(text(group)).toBe("7/4/2030");
    // oxlint-disable-next-line no-await-in-loop
    await user.click(getByRole("button", { name: "Clear" }));
    expect(text(group)).toBe("––/––/––––");
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

test("disabled and read-only: the trigger is disabled and the popup can't open", async () => {
  const { getByTestId, getByRole } = mount(options);
  const disabled = getByRole("button", { name: "Calendar Disabled" });
  expect(disabled.matches(":disabled")).toBe(true);
  expect(getByTestId("disabled").hasAttribute("data-disabled")).toBe(true);
  for (const segment of segments(getByTestId("disabled")))
    expect(segment.hasAttribute("contenteditable")).toBe(false);
  const readOnly = getByRole("button", { name: "Calendar Read only" });
  expect(readOnly.matches(":disabled")).toBe(true);
  expect(segments(getByTestId("readonly"))[0].getAttribute("aria-readonly")).toBe("true");
  expect(shown(getByTestId("disabled-popup"))).toBe(false);
});

test("closeOnSelect false: picking a day keeps the popup open", async () => {
  const { getByTestId, getByRole, user } = mount(options);
  const popup = getByTestId("stays-popup");
  getByRole("button", { name: "Calendar Stays open" }).focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(day("2030-05-08", popup));
  await user.keyboard("{ArrowRight}{Enter}");
  await frame();
  expect(shown(popup)).toBe(true);
  expect(text(getByTestId("stays"))).toBe("5/9/2030");
  await user.keyboard("{ArrowRight}{Enter}{Escape}");
  await expect.poll(() => shown(popup)).toBe(false);
  expect(text(getByTestId("stays"))).toBe("5/10/2030");
});

test("inside a Field: FieldLabel names the group and the popup, validated on submit, submitted by the Form", async () => {
  const { getByRole, getByTestId, user } = mount(fieldFixture);
  const group = getByTestId("due");
  const popup = getByTestId("popup");
  expect(getByRole("group", { name: "Due date" })).toBe(group);
  expect(popup.getAttribute("aria-labelledby")).toBe(group.getAttribute("aria-labelledby"));
  expect(getByRole("button", { name: "Calendar Due date" })).toBeTruthy();
  const month = getByRole("spinbutton", { name: "Due date month" });
  expect(group.getAttribute("aria-describedby")).toBe(getByTestId("description").id);
  // One hidden input: the picker's, not the field's or the calendar's.
  expect(document.querySelectorAll('input[name="due"]')).toHaveLength(1);

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("");
  expect(group.hasAttribute("data-invalid")).toBe(true);
  expect(getByTestId("error").textContent).not.toBe("");
  // The segments are described by the Field's description and error, and invalid with it, though the field inside
  // the picker doesn't see the FieldRoot.
  const described = `${getByTestId("description").id} ${getByTestId("error").id}`;
  for (const segment of segments(group)) {
    expect(segment.getAttribute("aria-describedby")).toBe(described);
    expect(segment.getAttribute("aria-invalid")).toBe("true");
  }

  await user.click(month);
  await user.keyboard("05132030");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("error").textContent).toBe("This date is unavailable.");
  expect(getByTestId("submitted").textContent).toBe("");

  await user.click(month);
  await user.keyboard("{ArrowRight}{ArrowUp}");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("due=2030-05-14");
  expect(group.hasAttribute("data-invalid")).toBe(false);
});

test("four picks in a row, each from the keyboard, each closing and focusing the trigger", async () => {
  const { popup, trigger, changes, user } = setup();
  for (let i = 0; i < 4; i++) {
    trigger.focus();
    // oxlint-disable-next-line no-await-in-loop -- each step acts on what the one before left
    await user.keyboard("{Enter}");
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => shown(popup)).toBe(true);
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => document.activeElement).toBe(day(`2030-05-${15 + i}`));
    // oxlint-disable-next-line no-await-in-loop
    await user.keyboard("{ArrowRight}{Enter}");
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => document.activeElement).toBe(trigger);
  }
  expect(changes()).toBe("2030-05-16 2030-05-17 2030-05-18 2030-05-19");
});
