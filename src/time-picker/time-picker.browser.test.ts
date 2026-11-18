// The time picker in Chromium, Firefox and WebKit (fixtures/basic.rx): a Time Field, a popover trigger and a popup
// of listbox columns behind one value.
import { afterEach, expect, test, vi } from "vitest";
import { mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import gridFixture from "./fixtures/grid.rx";
import fieldFixture from "./fixtures/field.rx";
import optionsFixture from "./fixtures/options.rx";

function formValue(form: HTMLElement, name: string) {
  return new FormData(form as HTMLFormElement).getAll(name);
}

afterEach(() => {
  vi.restoreAllMocks();
});

// The time it is, for the pickers that open on the current time.
function itIs(text: string) {
  vi.spyOn(Temporal.Now, "plainTimeISO").mockReturnValue(Temporal.PlainTime.from(text));
}

async function setup() {
  const mounted = mount(basic);
  const group = (name: string) => mounted.getByRole("group", { name });
  const shown = (name: string) =>
    Array.from(group(name).querySelectorAll("[data-bisque-segment]"))
      .map((s) => s.textContent)
      .join("");
  const popup = (id: string) => mounted.getByTestId(id);
  const isOpen = (id: string) => popup(id).matches(":popover-open");
  const column = (id: string, name: string) =>
    popup(id).querySelector<HTMLElement>(`[role=listbox][aria-label="${name}"]`);
  const option = (id: string, name: string, label: string) =>
    Array.from(column(id, name)?.querySelectorAll<HTMLElement>("[role=option]") ?? []).find(
      (o) => o.textContent === label,
    )!;
  // By value: an engine's ICU may write an hour as "8" or "08".
  const valued = (id: string, name: string, value: string) =>
    column(id, name)!.querySelector<HTMLElement>(`[role=option][data-value="${value}"]`)!;
  const selected = (id: string, name: string) =>
    column(id, name)?.querySelector("[role=option][aria-selected=true]")?.textContent ?? null;
  const text = (id: string) => mounted.getByTestId(id).textContent;
  // Open, with focus moved in (a frame after the popover shows).
  const opened = async (id: string) => {
    await expect.poll(() => isOpen(id)).toBe(true);
    await expect.poll(() => popup(id).contains(document.activeElement)).toBe(true);
  };
  return { ...mounted, group, shown, popup, isOpen, opened, column, option, valued, selected, text };
}

test("closed at first; the trigger is a labelled popover button and the popup a labelled dialog", async () => {
  const { getByRole, popup, isOpen, shown } = await setup();
  const trigger = getByRole("button", { name: "Open start" });
  expect(isOpen("start-popup")).toBe(false);
  expect(trigger.getAttribute("popovertarget")).toBe(popup("start-popup").id);
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(popup("start-popup").getAttribute("role")).toBe("dialog");
  expect(popup("start-popup").getAttribute("aria-label")).toBe("Choose time");
  expect(getByRole("button", { name: "Open alarm" })).toBeTruthy();
  expect(shown("Start")).toBe("9:30 AM");
});

test("opening focuses the selected hour and scrolls each column to its selected option", async () => {
  const { getByRole, user, opened, column, selected, option } = await setup();
  await user.click(getByRole("button", { name: "Open start" }));
  await opened("start-popup");
  await expect.poll(() => document.activeElement).toBe(option("start-popup", "Hours", "9"));
  expect(selected("start-popup", "Hours")).toBe("9");
  expect(selected("start-popup", "Minutes")).toBe("30");
  expect(selected("start-popup", "AM/PM")).toBe("AM");
  // Only the columns this picker uses: no seconds at minute granularity.
  expect(column("start-popup", "Seconds")).toBeNull();
  // The minutes are every 15.
  const minutes = Array.from(column("start-popup", "Minutes")!.querySelectorAll("[role=option]")).map(
    (o) => o.textContent,
  );
  expect(minutes).toEqual(["00", "15", "30", "45"]);
  // The selected hour is scrolled into the middle of its 120px column.
  const hours = column("start-popup", "Hours")!;
  const nine = option("start-popup", "Hours", "9");
  const listBox = hours.getBoundingClientRect();
  const itemBox = nine.getBoundingClientRect();
  expect(hours.scrollTop).toBeGreaterThan(0);
  expect(itemBox.top).toBeGreaterThanOrEqual(listBox.top - 1);
  expect(itemBox.bottom).toBeLessThanOrEqual(listBox.bottom + 1);
});

test("a click in a column updates the field at once and keeps the popup open", async () => {
  const { getByRole, getByTestId, user, isOpen, opened, option, shown, text, selected } = await setup();
  await user.click(getByRole("button", { name: "Open start" }));
  await opened("start-popup");
  await user.click(option("start-popup", "Minutes", "45"));
  expect(shown("Start")).toBe("9:45 AM");
  expect(isOpen("start-popup")).toBe(true);
  await user.click(option("start-popup", "AM/PM", "PM"));
  expect(shown("Start")).toBe("9:45 PM");
  // The hours follow the day period.
  expect(selected("start-popup", "Hours")).toBe("9");
  await user.click(option("start-popup", "Hours", "11"));
  expect(shown("Start")).toBe("11:45 PM");
  expect(text("changes")).toBe("09:45:00 21:45:00 23:45:00");
  expect(formValue(getByTestId("form"), "start")).toEqual(["23:45"]);
  expect(isOpen("start-popup")).toBe(true);
});

test("arrow keys move within a column, Left and Right between columns, Space chooses, Enter chooses and closes", async () => {
  const { getByRole, user, isOpen, option, shown } = await setup();
  getByRole("button", { name: "Open start" }).focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(option("start-popup", "Hours", "9"));
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(option("start-popup", "Hours", "10"));
  // Moving focus doesn't choose.
  expect(shown("Start")).toBe("9:30 AM");
  await user.keyboard(" ");
  expect(shown("Start")).toBe("10:30 AM");
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(option("start-popup", "Minutes", "30"));
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(option("start-popup", "AM/PM", "AM"));
  await user.keyboard("{ArrowLeft}");
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(option("start-popup", "Minutes", "45"));
  await user.keyboard("{Enter}");
  expect(shown("Start")).toBe("10:45 AM");
  await expect.poll(() => isOpen("start-popup")).toBe(false);
  expect(document.activeElement).toBe(getByRole("button", { name: "Open start" }));
});

test("Tab moves from column to column", async () => {
  const { getByRole, user, option } = await setup();
  getByRole("button", { name: "Open start" }).focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(option("start-popup", "Hours", "9"));
  await user.keyboard("{Tab}");
  expect(document.activeElement).toBe(option("start-popup", "Minutes", "30"));
  await user.keyboard("{Tab}");
  expect(document.activeElement).toBe(option("start-popup", "AM/PM", "AM"));
});

test("Escape closes and gives focus back to the trigger, also when a click opened it", async () => {
  const { getByRole, user, isOpen, opened } = await setup();
  // Opened with a click: WebKit doesn't focus the button, so the browser alone would leave focus on the page.
  await user.click(getByRole("button", { name: "Open start" }));
  await opened("start-popup");
  await user.keyboard("{Escape}");
  await expect.poll(() => isOpen("start-popup")).toBe(false);
  expect(document.activeElement).toBe(getByRole("button", { name: "Open start" }));
});

test("Tab past the last column closes the popup and focus moves on", async () => {
  const { getByRole, user, isOpen, opened, option, popup } = await setup();
  getByRole("button", { name: "Open start" }).focus();
  await user.keyboard("{Enter}");
  await opened("start-popup");
  option("start-popup", "AM/PM", "AM").focus();
  await user.keyboard("{Tab}");
  await expect.poll(() => isOpen("start-popup")).toBe(false);
  expect(popup("start-popup").contains(document.activeElement)).toBe(false);
});

test("a press outside closes it", async () => {
  const { getByRole, user, isOpen, opened, text } = await setup();
  await user.click(getByRole("button", { name: "Open start" }));
  await opened("start-popup");
  await user.click(getByRole("textbox", { name: "After" }));
  await expect.poll(() => isOpen("start-popup")).toBe(false);
  await expect.poll(() => text("opens")).toBe("true false");
});

test("typing in the field moves the columns' selection", async () => {
  const { getByRole, user, opened, selected, group, shown } = await setup();
  const hour = group("Start").querySelector<HTMLElement>("[role=spinbutton][data-type=hour]")!;
  await user.click(hour);
  await user.keyboard("{ArrowUp}");
  await user.click(getByRole("button", { name: "Open start" }));
  await opened("start-popup");
  expect(selected("start-popup", "Hours")).toBe("10");
  // A minute off the step is valid and selects no minute.
  await user.click(group("Start").querySelector<HTMLElement>("[role=spinbutton][data-type=minute]")!);
  await user.keyboard("07");
  expect(shown("Start")).toBe("10:07 AM");
  await user.click(getByRole("button", { name: "Open start" }));
  await opened("start-popup");
  expect(selected("start-popup", "Minutes")).toBeNull();
  expect(group("Start").hasAttribute("data-invalid")).toBe(false);
});

test("24-hour with seconds: no day period, seconds every 10, options outside min and max disabled", async () => {
  itIs("12:10:00");
  const { getByRole, user, opened, column, valued, shown, getByTestId } = await setup();
  await user.click(getByRole("button", { name: "Open alarm" }));
  await opened("alarm-popup");
  expect(column("alarm-popup", "AM/PM")).toBeNull();
  const hours = Array.from(column("alarm-popup", "Hours")!.querySelectorAll("[role=option]"));
  expect(hours.length).toBe(24);
  expect(valued("alarm-popup", "Hours", "7").getAttribute("aria-disabled")).toBe("true");
  // 08:30 is the minimum: hour 8 has allowed minutes, so it can be chosen.
  expect(valued("alarm-popup", "Hours", "8").hasAttribute("aria-disabled")).toBe(false);
  expect(valued("alarm-popup", "Hours", "18").getAttribute("aria-disabled")).toBe("true");
  const seconds = Array.from(column("alarm-popup", "Seconds")!.querySelectorAll("[role=option]")).map(
    (o) => o.textContent,
  );
  expect(seconds).toEqual(["00", "10", "20", "30", "40", "50"]);
  // With no value, the field is empty; choosing an hour clamps the time into the bounds (it opened at 12:10:00).
  // From the keyboard: in Playwright's WebKit, a press on an option of a column scrolled inside the open popover
  // lands on the listbox (reproduced with the column's static markup in a bare popover; see the family's report).
  valued("alarm-popup", "Hours", "8").focus();
  await user.keyboard(" ");
  expect(shown("Alarm")).toMatch(/^0?8:30:00$/);
  expect(valued("alarm-popup", "Minutes", "15").getAttribute("aria-disabled")).toBe("true");
  expect(valued("alarm-popup", "Minutes", "30").hasAttribute("aria-disabled")).toBe(false);
  valued("alarm-popup", "Minutes", "45").focus();
  await user.keyboard(" ");
  valued("alarm-popup", "Seconds", "20").focus();
  await user.keyboard(" ");
  expect(shown("Alarm")).toMatch(/^0?8:45:20$/);
  expect(formValue(getByTestId("form"), "alarm")).toEqual(["08:45:20"]);
});

test("a form reset puts the default back", async () => {
  const { getByRole, getByTestId, user, opened, option, shown } = await setup();
  await user.click(getByRole("button", { name: "Open start" }));
  await opened("start-popup");
  await user.click(option("start-popup", "Minutes", "45"));
  await user.keyboard("{Escape}");
  expect(shown("Start")).toBe("9:45 AM");
  await user.click(getByRole("button", { name: "Reset" }));
  await expect.poll(() => shown("Start")).toBe("9:30 AM");
  expect(formValue(getByTestId("form"), "start")).toEqual(["09:30"]);
});

test("exactly one hidden input per picker submits the ISO time", async () => {
  const { getByTestId } = await setup();
  const form = getByTestId("form") as HTMLFormElement;
  expect(form.querySelectorAll("input").length).toBe(2);
  expect(formValue(form, "start")).toEqual(["09:30"]);
  expect(formValue(form, "alarm")).toEqual([""]);
});

test("controlled: the app's value shows, a choice reports, and the app can open and close it", async () => {
  const { getByRole, user, isOpen, opened, option, shown, text } = await setup();
  expect(shown("Controlled")).toBe("6:15 PM");
  await user.click(getByRole("button", { name: "Set morning" }));
  expect(shown("Controlled")).toBe("7:45 AM");
  await user.click(getByRole("button", { name: "Open controlled" }));
  await opened("controlled-popup");
  expect(text("controlled-open")).toBe("open");
  await user.click(option("controlled-popup", "Hours", "8"));
  expect(text("controlled-value")).toBe("08:45:00");
  expect(shown("Controlled")).toBe("8:45 AM");
  await user.keyboard("{Escape}");
  await expect.poll(() => text("controlled-open")).toBe("closed");
  expect(isOpen("controlled-popup")).toBe(false);
});

test("controlled open, opened and closed twice by the app", async () => {
  const { getByRole, user, isOpen, text } = await setup();
  const toggle = getByRole("button", { name: "Toggle controlled" });
  // The toggle button is outside the popup: its press would light-dismiss and its click reopen, so each close is
  // from the trigger.
  const trigger = getByRole("button", { name: "Open controlled" });
  await user.click(toggle);
  await expect.poll(() => isOpen("controlled-popup")).toBe(true);
  await user.click(trigger);
  await expect.poll(() => isOpen("controlled-popup")).toBe(false);
  expect(text("controlled-open")).toBe("closed");
  await user.click(toggle);
  await expect.poll(() => isOpen("controlled-popup")).toBe(true);
  await user.click(trigger);
  await expect.poll(() => isOpen("controlled-popup")).toBe(false);
  expect(text("controlled-open")).toBe("closed");
});

test("disabled and read-only: the trigger is disabled and nothing opens", async () => {
  const { getByRole, group } = await setup();
  const disabled = getByRole("button", { name: "Open disabled" }) as HTMLButtonElement;
  const readOnly = getByRole("button", { name: "Open read-only" }) as HTMLButtonElement;
  expect(disabled.disabled).toBe(true);
  expect(disabled.hasAttribute("data-disabled")).toBe(true);
  expect(readOnly.disabled).toBe(true);
  expect(readOnly.hasAttribute("data-readonly")).toBe(true);
  expect(group("Disabled").hasAttribute("data-disabled")).toBe(true);
  expect(group("Read-only").hasAttribute("data-readonly")).toBe(true);
});

test("inside a Field: labelled by it, one hidden input, validated and submitted by the Form", async () => {
  const { getByRole, getByTestId, user } = mount(fieldFixture);
  const root = getByTestId("start");
  expect(getByRole("group", { name: "Shift start" })).toBe(root);
  const form = getByTestId("form") as HTMLFormElement;
  // The field's hidden input is the only one: the popup's listboxes render none and don't register with the Field.
  // One per picker (the second picker is "Wake").
  expect(form.querySelectorAll("input").length).toBe(3);
  expect(new FormData(form).getAll("start")).toEqual([""]);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(root.hasAttribute("data-invalid")).toBe(true);
  expect(getByTestId("submitted").textContent).toBe("");
  const popup = getByTestId("start-popup");
  await user.click(getByRole("button", { name: "Open start" }));
  // Opening moves focus into the popup a frame later: wait for it before moving it.
  await expect.poll(() => popup.contains(document.activeElement)).toBe(true);
  const option = (name: string, value: string) =>
    popup.querySelector<HTMLElement>(`[role=listbox][aria-label="${name}"] [data-value="${value}"]`)!;
  // With no value the hours are those of the time it opened at; AM lists the morning, where those before 08:00 are
  // disabled (and choosing AM clamps the time to 08:00 at the earliest).
  option("AM/PM", "0").focus();
  await user.keyboard(" ");
  expect(option("Hours", "7").getAttribute("aria-disabled")).toBe("true");
  expect(option("Hours", "8").hasAttribute("aria-disabled")).toBe(false);
  option("Hours", "9").focus();
  await user.keyboard(" ");
  option("Minutes", "30").focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => popup.matches(":popover-open")).toBe(false);
  await expect.poll(() => new FormData(form).getAll("start")).toEqual(["09:30"]);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("start=09:30");
  expect((getByRole("button", { name: "Open locked" }) as HTMLButtonElement).disabled).toBe(true);
});

test("the one-list variant: whole times every 30 minutes, out-of-range ones disabled, a choice closes it", async () => {
  const { getByRole, getByTestId, user } = mount(optionsFixture);
  const popup = getByTestId("popup");
  const list = popup.querySelector<HTMLElement>("[role=listbox]")!;
  expect(list.getAttribute("aria-label")).toBe("Times");
  const item = (value: string) => list.querySelector<HTMLElement>(`[data-value="${value}"]`)!;
  expect(list.querySelectorAll("[role=option]").length).toBe(48);
  expect(item("08:30").getAttribute("aria-disabled")).toBe("true");
  expect(item("09:00").hasAttribute("aria-disabled")).toBe(false);
  expect(item("17:00").hasAttribute("aria-disabled")).toBe(false);
  expect(item("17:30").getAttribute("aria-disabled")).toBe("true");
  expect(item("10:00").textContent).toBe("10:00 AM");
  const trigger = getByRole("button", { name: "Open meeting" });
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(item("10:00"));
  expect(item("10:00").getAttribute("aria-selected")).toBe("true");
  await user.keyboard("{ArrowDown}{Enter}");
  await expect.poll(() => popup.matches(":popover-open")).toBe(false);
  expect(document.activeElement).toBe(trigger);
  expect(new FormData(getByTestId("form") as HTMLFormElement).getAll("meeting")).toEqual(["10:30"]);
  await user.click(trigger);
  await expect.poll(() => popup.matches(":popover-open")).toBe(true);
  await expect.poll(() => document.activeElement).toBe(item("10:30"));
  await user.click(item("11:00"));
  await expect.poll(() => popup.matches(":popover-open")).toBe(false);
  expect(getByTestId("changes").textContent).toBe("10:30:00 11:00:00");
});

test("with no value at 14:37:42, the columns open on it rounded to the steps, and a first choice starts from that", async () => {
  itIs("14:37:42");
  const { getByRole, user, opened, valued, selected, shown, getByTestId } = await setup();
  await user.click(getByRole("button", { name: "Open alarm" }));
  await opened("alarm-popup");
  expect(selected("alarm-popup", "Hours")).toBeNull();
  expect(document.activeElement).toBe(valued("alarm-popup", "Hours", "14"));
  expect(valued("alarm-popup", "Minutes", "37").getAttribute("tabindex")).toBe("0");
  // Seconds every 10: 42 rounds to 40.
  expect(valued("alarm-popup", "Seconds", "40").getAttribute("tabindex")).toBe("0");
  valued("alarm-popup", "Hours", "9").focus();
  await user.keyboard(" ");
  expect(shown("Alarm")).toMatch(/^0?9:37:40$/);
  expect(new FormData(getByTestId("form") as HTMLFormElement).getAll("alarm")).toEqual(["09:37:40"]);
});

test("with no value at 03:10:05, outside min and max, the columns open on the earliest allowed time", async () => {
  itIs("03:10:05");
  const { getByRole, user, opened, valued, shown } = await setup();
  await user.click(getByRole("button", { name: "Open alarm" }));
  await opened("alarm-popup");
  expect(document.activeElement).toBe(valued("alarm-popup", "Hours", "8"));
  expect(valued("alarm-popup", "Hours", "3").getAttribute("aria-disabled")).toBe("true");
  expect(valued("alarm-popup", "Minutes", "30").getAttribute("tabindex")).toBe("0");
  expect(valued("alarm-popup", "Minutes", "15").getAttribute("aria-disabled")).toBe("true");
  valued("alarm-popup", "Minutes", "45").focus();
  await user.keyboard(" ");
  expect(shown("Alarm")).toMatch(/^0?8:45:00$/);
});

test("inside a FieldRoot, the segments carry the Field's description and its invalid state", async () => {
  const { getByRole, getByTestId, user } = mount(fieldFixture);
  const root = getByTestId("start");
  const hour = root.querySelector<HTMLElement>("[role=spinbutton][data-type=hour]")!;
  const descriptionId = getByTestId("description").id;
  expect(hour.getAttribute("aria-describedby")?.split(" ")).toContain(descriptionId);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(hour.getAttribute("aria-invalid")).toBe("true");
  expect(hour.getAttribute("aria-describedby")?.split(" ")).toContain(getByTestId("error").id);
});

test("inside a FieldRoot, a form reset after a choice restores the default and the Field is not dirty", async () => {
  const { getByRole, getByTestId, user } = mount(fieldFixture);
  const group = getByRole("group", { name: "Wake" });
  const fieldRoot = group.parentElement!;
  const popup = getByTestId("wake-popup");
  await user.click(getByRole("button", { name: "Open wake" }));
  await expect.poll(() => popup.contains(document.activeElement)).toBe(true);
  await user.click(popup.querySelector<HTMLElement>('[aria-label="Minutes"] [data-value="30"]')!);
  await user.keyboard("{Escape}");
  await expect.poll(() => fieldRoot.hasAttribute("data-dirty")).toBe(true);
  await user.click(getByRole("button", { name: "Reset" }));
  await expect
    .poll(() => new FormData(getByTestId("form") as HTMLFormElement).getAll("wake"))
    .toEqual(["07:00"]);
  await expect.poll(() => fieldRoot.hasAttribute("data-dirty")).toBe(false);
});

test("right to left: Left and Right are mirrored between columns", async () => {
  const { getByRole, user, opened, option, column } = await setup();
  getByRole("button", { name: "Open rtl" }).focus();
  await user.keyboard("{Enter}");
  await opened("rtl-popup");
  expect(document.activeElement).toBe(option("rtl-popup", "Hours", "9"));
  // The hours are on the right: the minutes are to their left.
  const hours = column("rtl-popup", "Hours")!.getBoundingClientRect();
  const minutes = column("rtl-popup", "Minutes")!.getBoundingClientRect();
  expect(minutes.right).toBeLessThanOrEqual(hours.left + 1);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(option("rtl-popup", "Minutes", "30"));
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(option("rtl-popup", "AM/PM", "AM"));
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(document.activeElement).toBe(option("rtl-popup", "Hours", "9"));
  // Nothing further right than the hours.
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(option("rtl-popup", "Hours", "9"));
});

const focused = () => document.activeElement?.textContent;

test("number pad arrows follow rows and columns while Tab moves between units", async () => {
  const { getByRole, user } = mount(gridFixture);
  await user.click(getByRole("button", { name: "Choose time" }));
  await expect.poll(focused).toBe("9");
  await user.keyboard("{ArrowUp}{ArrowRight}");
  expect(focused()).toBe("4");
  await user.keyboard("{ArrowDown}{ArrowRight}{ArrowRight}{ArrowRight}");
  expect(focused()).toBe("12");
  await user.keyboard(" ");
  expect(document.activeElement?.getAttribute("aria-selected")).toBe("true");
  await user.keyboard("{Tab}");
  expect(focused()).toBe("30");
  await user.keyboard("{ArrowUp}{ArrowLeft}");
  expect(focused()).toBe("00");
});
