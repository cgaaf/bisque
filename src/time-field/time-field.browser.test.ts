// Time Field in Chromium, Firefox and WebKit (fixtures/basic.rx). The segment behaviour is shared with Date Field
// (../internal/segmented-field.rx, tested in full in ../date-field); this covers what is the time's own: the hour
// cycle, the day period, granularity, the form string and min/max as times.
import { expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import fieldFixture from "./fixtures/field.rx";

function segments(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("[role=spinbutton]"));
}

function shown(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-bisque-segment]"))
    .map((s) => s.textContent)
    .join("");
}

// The hidden input that submits the field's value comes right after its root.
function hidden(root: HTMLElement) {
  return root.nextElementSibling as HTMLInputElement;
}

function setup() {
  const mounted = mount(basic);
  const field = (id: string) => mounted.getByTestId(id);
  const changes = () => mounted.getByTestId("changes").textContent;
  return { ...mounted, field, changes };
}

test("segments follow the locale and the options", () => {
  const { field, getByRole } = setup();
  expect(segments(field("us")).map((s) => s.dataset.type)).toEqual(["hour", "minute", "dayPeriod"]);
  expect(segments(field("de")).map((s) => s.dataset.type)).toEqual(["hour", "minute", "second"]);
  expect(segments(field("h24")).map((s) => s.dataset.type)).toEqual(["hour"]);
  // Whether de-DE pads the hour of 24-hour time depends on the engine's locale data.
  expect(shown(field("de"))).toMatch(/^0?7:05:09$/);
  expect(hidden(field("de")).type).toBe("time");
  const hour = getByRole("spinbutton", { name: "Start time hour" });
  expect(hour.getAttribute("aria-valuemin")).toBe("1");
  expect(hour.getAttribute("aria-valuemax")).toBe("12");
  expect(
    // The segment labels are in the field's locale.
    getByRole("spinbutton", { name: "Alarm Stunde" }).getAttribute("aria-valuemax"),
  ).toBe("23");
  expect(getByRole("spinbutton", { name: "Forced 24 hour" }).getAttribute("aria-valuemax")).toBe("23");
  const period = getByRole("spinbutton", { name: /Start time AM\/PM/i });
  expect(period.getAttribute("inputmode")).toBe("text");
});

test("typing a 12-hour time: the value waits for the day period", async () => {
  const { field, user, changes } = setup();
  const root = field("us");
  const [hour, minute, period] = segments(root);
  await user.click(hour);
  await user.keyboard("1");
  // 1 could still become 10–12.
  expect(document.activeElement).toBe(hour);
  await user.keyboard("1");
  expect(document.activeElement).toBe(minute);
  await user.keyboard("45");
  expect(document.activeElement).toBe(period);
  expect(changes()).toBe("");
  expect(hidden(root).value).toBe("");
  await user.keyboard("p");
  expect(shown(root)).toBe("11:45 PM");
  expect(changes()).toBe("23:45:00");
  expect(hidden(root).value).toBe("23:45");
  await user.keyboard("a");
  expect(hidden(root).value).toBe("11:45");
  // Up and Down toggle the day period.
  await user.keyboard("{ArrowUp}");
  expect(period.textContent).toBe("PM");
  expect(changes()).toBe("23:45:00 11:45:00 23:45:00");
});

test("the hour steps around its cycle and keeps the day period; minutes step by 15 with PageUp", async () => {
  const { field, user } = setup();
  const root = field("us");
  const [hour, minute] = segments(root);
  await user.click(hour);
  // An empty hour takes the placeholder's: midnight, 12 AM.
  await user.keyboard("{ArrowUp}");
  expect(hour.textContent).toBe("12");
  await user.keyboard("{ArrowUp}");
  expect(hour.textContent).toBe("1");
  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(hour.textContent).toBe("11");
  await user.keyboard("{Home}");
  expect(hour.textContent).toBe("1");
  await user.keyboard("{End}");
  expect(hour.textContent).toBe("12");
  minute.focus();
  await user.keyboard("{ArrowUp}");
  expect(minute.textContent).toBe("00");
  await user.keyboard("{PageUp}{PageUp}");
  expect(minute.textContent).toBe("30");
  await user.keyboard("{PageDown}{PageDown}{PageDown}");
  expect(minute.textContent).toBe("45");
});

test("24-hour time and seconds: the form string goes down to the granularity", async () => {
  const { field, user } = setup();
  const root = field("de");
  const [hour, , second] = segments(root);
  await user.click(hour);
  await user.keyboard("13");
  expect(shown(root)).toBe("13:05:09");
  expect(hidden(root).value).toBe("13:05:09");
  second.focus();
  // 09 is one digit: one Backspace empties it.
  await user.keyboard("{Backspace}");
  expect(hidden(root).value).toBe("");
  await user.keyboard("3");
  expect(shown(root)).toBe("13:05:03");
  const h24 = field("h24");
  const [only] = segments(h24);
  await user.click(only);
  await user.keyboard("18");
  expect(shown(h24)).toBe("18");
  expect(hidden(h24).value).toBe("18:00");
});

test("a time outside min/max is kept and marks the field invalid", async () => {
  const { field, user } = setup();
  const root = field("de");
  const [hour] = segments(root);
  await user.click(hour);
  await user.keyboard("05");
  expect(shown(root)).toMatch(/^0?5:05:09$/);
  expect(root.hasAttribute("data-invalid")).toBe(true);
  expect(hidden(root).validity.rangeUnderflow).toBe(true);
  hour.focus();
  await user.keyboard("23");
  expect(hidden(root).validity.rangeOverflow).toBe(true);
  hour.focus();
  await user.keyboard("{Home}");
  expect(shown(root)).toMatch(/^0?0:05:09$/);
  await user.keyboard("{PageUp}{PageUp}{PageUp}{PageUp}");
  expect(shown(root)).toMatch(/^0?8:05:09$/);
  expect(root.hasAttribute("data-invalid")).toBe(false);
});

test("ar-EG shows Arabic digits and day periods, and takes Arabic digits", async () => {
  const { field, user } = setup();
  const root = field("ar");
  const types = segments(root).map((s) => s.dataset.type);
  expect(types).toEqual(["hour", "minute", "dayPeriod"]);
  const [hour, minute, period] = segments(root);
  await user.click(hour);
  await user.keyboard("٠٩");
  expect(hour.textContent).toBe("٩");
  expect(document.activeElement).toBe(minute);
  await user.keyboard("٣٠");
  expect(minute.textContent).toBe("٣٠");
  expect(document.activeElement).toBe(period);
  await user.keyboard("{ArrowUp}");
  expect(period.textContent).toBe("ص");
  expect(hidden(root).value).toBe("09:30");
  await user.keyboard("p");
  expect(period.textContent).toBe("م");
  expect(hidden(root).value).toBe("21:30");
});

test("a complete time that becomes incomplete reports undefined", async () => {
  const { field, user, changes } = setup();
  const [hour, minute] = segments(field("us"));
  await user.click(hour);
  await user.keyboard("0930a");
  expect(changes()).toBe("09:30:00");
  minute.focus();
  await user.keyboard("{Backspace}{Backspace}");
  expect(changes()).toBe("09:30:00 09:03:00 none");
});

test("controlled: the owner's value is shown and replaced from outside", async () => {
  const { field, user, getByRole, getByTestId } = setup();
  const root = field("controlled");
  const [hour] = segments(root);
  expect(shown(root)).toBe("9:30 AM");
  await user.click(hour);
  await user.keyboard("{ArrowUp}");
  expect(getByTestId("controlled-value").textContent).toBe("10:30:00");
  await user.keyboard("{Backspace}{Backspace}");
  expect(getByTestId("controlled-value").textContent).toBe("none");
  expect(shown(root)).toBe("––:30 AM");
  await user.click(getByRole("button", { name: "Set evening" }));
  expect(shown(root)).toBe("6:15 PM");
  await user.click(getByRole("button", { name: "Clear" }));
  expect(shown(root)).toBe("––:–– ––");
});

test("disabled: segments can't be focused or edited", () => {
  const { field } = setup();
  for (const segment of segments(field("disabled"))) {
    expect(segment.hasAttribute("tabindex")).toBe(false);
    expect(segment.hasAttribute("contenteditable")).toBe(false);
  }
});

test("the form submits the time, nothing while incomplete, and reset restores the default", async () => {
  const { field, user, getByRole, getByTestId } = setup();
  const form = getByTestId("form") as HTMLFormElement;
  expect(new FormData(form).get("alarm")).toBe("07:05:09");
  expect(new FormData(form).get("start")).toBe("");
  const [hour] = segments(field("us"));
  await user.click(hour);
  await user.keyboard("0145");
  expect(new FormData(form).get("start")).toBe("");
  await user.keyboard("p");
  expect(new FormData(form).get("start")).toBe("13:45");
  const [deHour] = segments(field("de"));
  deHour.focus();
  await user.keyboard("{ArrowUp}");
  expect(new FormData(form).get("alarm")).toBe("08:05:09");
  await user.click(getByRole("button", { name: "Reset" }));
  await expect.poll(() => shown(field("de"))).toMatch(/^0?7:05:09$/);
  expect(shown(field("us"))).toBe("––:–– ––");
  expect(new FormData(form).get("alarm")).toBe("07:05:09");
  expect(new FormData(form).get("start")).toBe("");
});

test("inside a Field: labelled by it, validated, submitted by the Form", async () => {
  const { getByRole, getByTestId, user } = mount(fieldFixture);
  const root = getByTestId("start");
  expect(getByRole("group", { name: "Start time" })).toBe(root);
  const hour = getByRole("spinbutton", { name: "Start time hour" });
  await user.click(getByRole("button", { name: "Submit" }));
  expect(root.hasAttribute("data-invalid")).toBe(true);
  await user.click(hour);
  await user.keyboard("0730");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("error").textContent).toBe("Enter a complete time.");
  await user.click(segments(root)[2]);
  await user.keyboard("a");
  await user.click(getByRole("button", { name: "Submit" }));
  // 7:30 AM is before `min` (8:00).
  expect(hidden(root).validity.rangeUnderflow).toBe(true);
  expect(getByTestId("submitted").textContent).toBe("");
  await user.click(segments(root)[2]);
  await user.keyboard("p");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("start=19:30");
  expect(getByTestId("locked").hasAttribute("data-disabled")).toBe(true);
});

test("controlled: set and cleared from outside twice", async () => {
  const { field, user, getByRole } = setup();
  const root = field("controlled");
  for (let round = 0; round < 2; round++) {
    // oxlint-disable-next-line no-await-in-loop -- presses one after another, as a person makes them
    await user.click(getByRole("button", { name: "Set evening" }));
    expect(shown(root)).toBe("6:15 PM");
    // oxlint-disable-next-line no-await-in-loop -- presses one after another, as a person makes them
    await user.click(getByRole("button", { name: "Clear" }));
    expect(shown(root)).toBe("––:–– ––");
  }
});

test("an outer composition gives the segments their invalid state and description, over the Field's", async () => {
  const { getByTestId } = mount(fieldFixture);
  const outside = getByTestId("outside");
  expect(outside.hasAttribute("data-invalid")).toBe(true);
  expect(outside.getAttribute("aria-invalid")).toBe("true");
  for (const segment of segments(outside)) {
    expect(segment.getAttribute("aria-invalid")).toBe("true");
    expect(segment.getAttribute("aria-describedby")).toBe("outside-hint");
    expect(segment.hasAttribute("data-invalid")).toBe(true);
  }
  const overridden = getByTestId("overridden");
  // The FieldRoot around it is invalid; `invalid={false}` on the field wins.
  expect(overridden.hasAttribute("data-invalid")).toBe(false);
  for (const segment of segments(overridden)) {
    expect(segment.hasAttribute("aria-invalid")).toBe(false);
    expect(segment.getAttribute("aria-describedby")).toBe("outside-hint");
  }
});
