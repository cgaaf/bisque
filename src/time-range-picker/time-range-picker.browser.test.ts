// The time range picker in Chromium, Firefox and WebKit (fixtures/basic.rx): two time pickers in one group, the end
// bounded by the start.
import { expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import fieldFixture from "./fixtures/field.rx";

async function setup() {
  const mounted = mount(basic);
  const group = (name: string) => mounted.getByRole("group", { name });
  const shown = (name: string) =>
    Array.from(group(name).querySelectorAll("[data-bisque-segment]"))
      .map((s) => s.textContent)
      .join("");
  const popup = (id: string) => mounted.getByTestId(id);
  const open = async (name: string, id: string) => {
    await mounted.user.click(mounted.getByRole("button", { name }));
    await expect.poll(() => popup(id).matches(":popover-open")).toBe(true);
    await expect.poll(() => popup(id).contains(document.activeElement)).toBe(true);
  };
  const option = (id: string, column: string, value: string) =>
    popup(id).querySelector<HTMLElement>(`[role=listbox][aria-label="${column}"] [data-value="${value}"]`)!;
  const form = () => mounted.getByTestId("form") as HTMLFormElement;
  const formValue = (name: string) => new FormData(form()).getAll(name);
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, group, shown, popup, open, option, form, formValue, text };
}

test("one labelled group holding a start and an end field, the separator hidden", async () => {
  const { group, shown } = await setup();
  const shift = group("Shift");
  expect(shift.contains(group("Start time"))).toBe(true);
  expect(shift.contains(group("End time"))).toBe(true);
  expect(shift.querySelector(":scope > span[aria-hidden=true]")?.textContent).toBe("–");
  expect(shown("Start time")).toBe("9:00 AM");
  expect(shown("End time")).toBe("5:00 PM");
  expect(shift.hasAttribute("data-invalid")).toBe(false);
});

test("submits `<name>-start` and `<name>-end`, one input each, or the names given", async () => {
  const { form, formValue } = await setup();
  expect(formValue("shift-start")).toEqual(["09:00"]);
  expect(formValue("shift-end")).toEqual(["17:00"]);
  expect(formValue("from")).toEqual(["22:00"]);
  expect(formValue("night-end")).toEqual(["06:00"]);
  expect(form().querySelectorAll("input").length).toBe(4);
});

test("each side has its own popup; a choice reports the whole range", async () => {
  const { open, option, shown, text, formValue, user } = await setup();
  await open("Open start", "start-popup");
  await user.click(option("start-popup", "Minutes", "30"));
  expect(shown("Start time")).toBe("9:30 AM");
  await user.keyboard("{Escape}");
  await open("Open end", "end-popup");
  expect(document.activeElement).toBe(option("end-popup", "Hours", "17"));
  await user.click(option("end-popup", "Hours", "18"));
  expect(shown("End time")).toBe("6:00 PM");
  expect(text("changes")).toBe("09:30/17:00 09:30/18:00");
  expect(formValue("shift-end")).toEqual(["18:00"]);
});

test("the end's popup disables what would put it before the start", async () => {
  const { open, option } = await setup();
  await open("Open end", "end-popup");
  // The end is 5 PM: the PM hours are listed; the AM period, wholly before 9:00, is disabled.
  expect(option("end-popup", "AM/PM", "0").hasAttribute("aria-disabled")).toBe(false);
  expect(option("end-popup", "Hours", "12").hasAttribute("aria-disabled")).toBe(false);
  option("end-popup", "AM/PM", "0").click();
  await expect.poll(() => option("end-popup", "Hours", "8")?.getAttribute("aria-disabled")).toBe("true");
  expect(option("end-popup", "Hours", "9").hasAttribute("aria-disabled")).toBe(false);
});

test("an end typed before the start is invalid, not swapped", async () => {
  const { group, shown, user } = await setup();
  const period = group("End time").querySelector<HTMLElement>("[role=spinbutton][data-type=dayPeriod]")!;
  await user.click(period);
  await user.keyboard("a");
  expect(shown("End time")).toBe("5:00 AM");
  expect(shown("Start time")).toBe("9:00 AM");
  expect(group("Shift").hasAttribute("data-invalid")).toBe(true);
  expect(group("Shift").getAttribute("aria-invalid")).toBe("true");
  expect(group("End time").hasAttribute("data-invalid")).toBe(true);
  // The start input, the one a FieldRoot reads, says why.
  const hidden = document.querySelector<HTMLInputElement>('input[name="shift-start"]')!;
  expect(hidden.validationMessage).toBe("The end time is before the start time.");
  await user.keyboard("p");
  expect(group("Shift").hasAttribute("data-invalid")).toBe(false);
});

test("with allowOvernight, an end before the start is valid", async () => {
  const { group } = await setup();
  expect(group("Night").hasAttribute("data-invalid")).toBe(false);
  expect(group("Night end").hasAttribute("data-invalid")).toBe(false);
});

test("a form reset puts the default range back", async () => {
  const { getByRole, open, option, shown, formValue, user } = await setup();
  await open("Open start", "start-popup");
  await user.click(option("start-popup", "Hours", "10"));
  await user.keyboard("{Escape}");
  expect(shown("Start time")).toBe("10:00 AM");
  await user.click(getByRole("button", { name: "Reset" }));
  await expect.poll(() => shown("Start time")).toBe("9:00 AM");
  expect(formValue("shift-start")).toEqual(["09:00"]);
  expect(shown("End time")).toBe("5:00 PM");
});

test("controlled: empty at first, the app's range shows, typing reports the range", async () => {
  const { getByRole, group, shown, text, user } = await setup();
  expect(group("Controlled start").querySelectorAll("[data-placeholder]").length).toBe(3);
  await user.click(getByRole("button", { name: "Set morning" }));
  expect(shown("Controlled start")).toBe("8:00 AM");
  expect(shown("Controlled end")).toBe("12:30 PM");
  const hour = group("Controlled end").querySelector<HTMLElement>("[role=spinbutton][data-type=hour]")!;
  await user.click(hour);
  await user.keyboard("{ArrowUp}");
  expect(text("controlled-value")).toBe("08:00/13:30");
});

test("disabled: both fields and the triggers are disabled", async () => {
  const { getByRole, group } = await setup();
  expect(group("Disabled").hasAttribute("data-disabled")).toBe(true);
  expect(group("Disabled start").hasAttribute("data-disabled")).toBe(true);
  expect(group("Disabled end").hasAttribute("data-disabled")).toBe(true);
  expect((getByRole("button", { name: "Open disabled start" }) as HTMLButtonElement).disabled).toBe(true);
});

function fieldSetup() {
  const mounted = mount(fieldFixture);
  const group = (name: string) => mounted.getByRole("group", { name });
  const segment = (name: string, kind: string) =>
    group(name).querySelector<HTMLElement>(`[role=spinbutton][data-type=${kind}]`)!;
  // A FieldError that has nothing to say isn't rendered.
  const text = (id: string) => mounted.queryByTestId(id)?.textContent ?? "";
  const submit = () => mounted.user.click(mounted.getByRole("button", { name: "Submit" }));
  const formData = () => new FormData(mounted.getByTestId("form") as HTMLFormElement);
  return { ...mounted, group, segment, text, submit, formData };
}

test("inside a FieldRoot: the group is labelled by it, one input per side under `<name>-start` / `-end`", () => {
  const { group, formData, getByTestId } = fieldSetup();
  expect(group("Shift")).toBe(getByTestId("shift"));
  expect(group("Shift").contains(group("Start time"))).toBe(true);
  expect(formData().getAll("shift-start")).toEqual(["09:00"]);
  expect(formData().getAll("shift-end")).toEqual(["17:00"]);
  expect(formData().getAll("shift")).toEqual([]);
  const form = getByTestId("form");
  expect(form.querySelectorAll('input[name^="shift"]').length).toBe(2);
  expect(group("Locked").hasAttribute("data-disabled")).toBe(true);
  expect(group("Locked start").hasAttribute("data-disabled")).toBe(true);
});

test("inside a FieldRoot, both sides' segments carry the Field's description and invalid state", async () => {
  const { segment, submit, getByTestId } = fieldSetup();
  const description = getByTestId("shift-description").id;
  for (const side of ["Start time", "End time"]) {
    expect(segment(side, "hour").getAttribute("aria-describedby")?.split(" ")).toContain(description);
  }
  await submit();
  // The empty, required break is invalid on both sides.
  for (const side of ["Break start", "Break end"]) {
    expect(segment(side, "hour").getAttribute("aria-invalid")).toBe("true");
    expect(segment(side, "hour").getAttribute("aria-describedby")?.split(" ")).toContain(
      getByTestId("break-error").id,
    );
  }
});

test("inside a FieldRoot: required and empty, incomplete and out of order are invalid; FieldError says why", async () => {
  const { group, segment, text, submit, user, getByTestId } = fieldSetup();
  await submit();
  expect(text("submitted")).toBe("");
  expect(getByTestId("break-field").hasAttribute("data-invalid")).toBe(true);
  expect(text("break-error")).not.toBe("");
  // Incomplete: an hour alone.
  await user.click(segment("Break start", "hour"));
  await user.keyboard("1");
  await submit();
  expect(text("break-error")).toBe("Enter a complete time.");
  // Out of order: the shift's end moved to the morning.
  await user.click(segment("End time", "dayPeriod"));
  await user.keyboard("a");
  await submit();
  expect(getByTestId("shift-field").hasAttribute("data-invalid")).toBe(true);
  expect(group("Shift").hasAttribute("data-invalid")).toBe(true);
  expect(text("shift-error")).toBe("The end time is before the start time.");
  expect(segment("End time", "hour").getAttribute("aria-invalid")).toBe("true");
  // Put right, the Form receives the values (the overnight range is valid as it is).
  await user.click(segment("End time", "dayPeriod"));
  await user.keyboard("p");
  await user.click(segment("Break start", "hour"));
  await user.keyboard("{Backspace}{Backspace}1200p");
  await user.click(segment("Break end", "hour"));
  await user.keyboard("1230p");
  await submit();
  expect([text("shift-error"), text("break-error")]).toEqual(["", ""]);
  expect(text("submitted")).toBe("shift=09:00/17:00 night=22:00/06:00");
  expect(text("shift-error")).toBe("");
});

test("inside a FieldRoot, a form reset restores the default range and clears dirty", async () => {
  const { segment, user, formData, getByTestId, getByRole } = fieldSetup();
  await user.click(segment("Start time", "hour"));
  await user.keyboard("{ArrowUp}");
  expect(formData().getAll("shift-start")).toEqual(["10:00"]);
  await expect.poll(() => getByTestId("shift-field").hasAttribute("data-dirty")).toBe(true);
  await user.click(getByRole("button", { name: "Reset" }));
  await expect.poll(() => formData().getAll("shift-start")).toEqual(["09:00"]);
  expect(segment("Start time", "hour").textContent).toBe("9");
  await expect.poll(() => getByTestId("shift-field").hasAttribute("data-dirty")).toBe(false);
});
