import { fireEvent } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { isNumberText, parseNumberText, validateNumber } from "../internal/impl/number-field.ts";
import { flush, mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import field from "./fixtures/field.rx";

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Advances fake time in 20ms slices, applying updates after each. In a browser each timer is its own task, so
 * updates apply between ticks; one `advanceTimersByTime` would run them all before any applies.
 */
function advance(ms: number) {
  for (let left = ms; left > 0; left -= 20) {
    vi.advanceTimersByTime(Math.min(20, left));
    flush();
  }
}

test("parses locale text, labels and percentages", () => {
  expect(parseNumberText("1,234.5", "en-US", undefined)).toBe(1234.5);
  expect(parseNumberText("1.234,5 €", "de-DE", { style: "currency", currency: "EUR" })).toBe(1234.5);
  expect(parseNumberText("−12", "en-US", undefined)).toBe(-12);
  expect(parseNumberText("25%", "en-US", { style: "percent" })).toBe(0.25);
  expect(parseNumberText("25", "en-US", { style: "percent" })).toBe(0.25);
  expect(parseNumberText("١٢٣", "ar-EG", undefined)).toBe(123);
  expect(parseNumberText("1 234,5", "fr-FR", undefined)).toBe(1234.5);
  expect(parseNumberText("abc", "en-US", undefined)).toBeNull();
  expect(parseNumberText(".", "en-US", undefined)).toBeNull();
  expect(isNumberText("12.5", "en-US", undefined, false)).toBe(true);
  expect(isNumberText("-1", "en-US", undefined, false)).toBe(false);
  expect(isNumberText("-1", "en-US", undefined, true)).toBe(true);
  expect(isNumberText("1a", "en-US", undefined, true)).toBe(false);
});

test("steps without float noise, snaps and clamps", () => {
  expect(validateNumber(0.1 + 0.2, 0.1, undefined, undefined, undefined, false, false, true)).toBe(0.3);
  expect(validateNumber(7.3 + 5, 5, 0, 100, undefined, true, false, true)).toBe(10);
  expect(validateNumber(7.3 - 5, -5, 0, 100, undefined, true, false, true)).toBe(5);
  expect(validateNumber(150, 1, 0, 100, undefined, false, false, true)).toBe(100);
  expect(validateNumber(150, undefined, 0, 100, undefined, false, false, false)).toBe(150);
  expect(validateNumber(null, 1, 0, 100, undefined, false, false, true)).toBeNull();
});

test("renders a text input with the formatted value and the state attributes", () => {
  const { getByLabelText, getByTestId } = mount(basic);
  const input = getByLabelText("Quantity") as HTMLInputElement;
  expect(input.type).toBe("text");
  expect(input.value).toBe("5");
  expect(input.getAttribute("inputmode")).toBe("numeric");
  expect(input.getAttribute("aria-roledescription")).toBe("Number field");
  expect(getByTestId("group").getAttribute("role")).toBe("group");
  expect(getByTestId("increment").getAttribute("aria-label")).toBe("Increase");
  expect(getByTestId("increment").getAttribute("aria-controls")).toBe(input.id);
  expect(getByTestId("increment").getAttribute("tabindex")).toBe("-1");
  expect((getByLabelText("Price") as HTMLInputElement).value).toBe("1.234,50\u00a0€");
  expect((getByLabelText("Ratio") as HTMLInputElement).value).toBe("25%");
});

test("arrow keys step; Shift and Alt take the large and small steps; Home and End go to the bounds", async () => {
  const { getByLabelText, getByTestId, user } = mount(basic);
  const input = getByLabelText("Quantity") as HTMLInputElement;
  input.focus();
  await user.keyboard("{ArrowUp}");
  expect(input.value).toBe("6");
  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(input.value).toBe("4");
  await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
  expect(input.value).toBe("14");
  await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
  expect(input.value).toBe("14.1");
  await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
  expect(input.value).toBe("20");
  await user.keyboard("{Home}");
  expect(input.value).toBe("0");
  await user.keyboard("{ArrowDown}");
  expect(input.value).toBe("0");
  await user.keyboard("{End}");
  expect(input.value).toBe("20");
  expect(getByTestId("changes").textContent).toBe(
    "6:keyboard 5:keyboard 4:keyboard 14:keyboard 14.1:keyboard 20:keyboard 0:keyboard 20:keyboard",
  );
  expect(getByTestId("commits").textContent).toBe(getByTestId("changes").textContent);
});

test("typing changes the value as it parses; blur clamps, commits and formats", async () => {
  const { getByLabelText, getByTestId, getByRole, user } = mount(basic);
  const input = getByLabelText("Quantity") as HTMLInputElement;
  await user.clear(input);
  expect(getByTestId("changes").textContent).toBe("null:input-clear");
  await user.type(input, "18");
  expect(input.value).toBe("18");
  expect(getByTestId("changes").textContent).toBe("null:input-clear 1:input-change 18:input-change");
  expect(getByTestId("commits").textContent).toBe("");
  // A letter is refused.
  await user.type(input, "x");
  expect(input.value).toBe("18");
  // Past the maximum: the value clamps as it is typed, the text on blur.
  await user.type(input, "0");
  expect(input.value).toBe("180");
  await user.click(getByRole("button", { name: "Elsewhere" }));
  expect(input.value).toBe("20");
  expect(getByTestId("commits").textContent).toBe("20:input-blur");
  expect(new FormData(getByTestId("form") as HTMLFormElement).get("quantity")).toBe("20");
});

test("clearing and leaving the input empties the value", async () => {
  const { getByLabelText, getByTestId, getByRole, user } = mount(basic);
  const input = getByLabelText("Quantity") as HTMLInputElement;
  await user.clear(input);
  await user.click(getByRole("button", { name: "Elsewhere" }));
  expect(input.value).toBe("");
  expect(getByTestId("commits").textContent).toBe("null:input-clear");
  expect(new FormData(getByTestId("form") as HTMLFormElement).get("quantity")).toBe("");
  // Stepping from empty starts at 0.
  await user.click(getByTestId("increment"));
  expect(input.value).toBe("0");
});

test("locale-aware: typed German currency text is read and reformatted", async () => {
  const { getByLabelText, getByRole, getByTestId, user } = mount(basic);
  const input = getByLabelText("Price") as HTMLInputElement;
  await user.clear(input);
  await user.type(input, "2.000,25");
  await user.click(getByRole("button", { name: "Elsewhere" }));
  expect(input.value).toBe("2.000,25\u00a0€");
  expect(new FormData(getByTestId("form") as HTMLFormElement).get("price")).toBe("2000.25");
  input.focus();
  await user.keyboard("{ArrowUp}");
  expect(input.value).toBe("2.000,75\u00a0€");
});

test("percent: steps snap to the step", async () => {
  const { getByLabelText, user } = mount(basic);
  const input = getByLabelText("Ratio") as HTMLInputElement;
  await user.clear(input);
  await user.type(input, "12.5");
  input.focus();
  await user.keyboard("{ArrowUp}");
  expect(input.value).toBe("13%");
});

test("a stepper click steps once and commits; focus stays in the input", async () => {
  const { getByLabelText, getByTestId, user } = mount(basic);
  const input = getByLabelText("Quantity") as HTMLInputElement;
  await user.click(getByTestId("increment"));
  expect(input.value).toBe("6");
  expect(document.activeElement).toBe(input);
  await user.click(getByTestId("decrement"));
  await user.click(getByTestId("decrement"));
  expect(input.value).toBe("4");
  expect(getByTestId("changes").textContent).toBe("6:increment-press 5:decrement-press 4:decrement-press");
  expect(getByTestId("commits").textContent).toBe("6:increment-press 5:decrement-press 4:decrement-press");
});

test("a stepper steps from what was typed, before blur", async () => {
  const { getByLabelText, getByTestId, user } = mount(basic);
  const input = getByLabelText("Quantity") as HTMLInputElement;
  await user.clear(input);
  await user.type(input, "12");
  await user.click(getByTestId("increment"));
  expect(input.value).toBe("13");
});

test("holding a stepper repeats after a delay, stops at the bound, and commits on release", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  const { getByLabelText, getByTestId } = mount(basic);
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  const input = getByLabelText("Quantity") as HTMLInputElement;
  const increment = getByTestId("increment") as HTMLButtonElement;
  await user.pointer({ keys: "[MouseLeft>]", target: increment });
  expect(input.value).toBe("6");
  advance(399);
  expect(input.value).toBe("6");
  advance(61);
  expect(input.value).toBe("7");
  advance(60 * 3);
  expect(input.value).toBe("10");
  expect(getByTestId("commits").textContent).toBe("");
  advance(60 * 20);
  expect(input.value).toBe("20");
  expect(increment.disabled).toBe(true);
  expect(increment.hasAttribute("data-disabled")).toBe(true);
  await user.pointer({ keys: "[/MouseLeft]", target: increment });
  expect(getByTestId("commits").textContent).toBe("20:increment-press");
});

test("holding a stepper with Shift repeats the large step", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  const { getByLabelText, getByTestId } = mount(basic);
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  const input = getByLabelText("Quantity") as HTMLInputElement;
  const increment = getByTestId("increment");
  await user.keyboard("{Shift>}");
  await user.pointer({ keys: "[MouseLeft>]", target: increment });
  expect(input.value).toBe("15");
  // The first repeat steps 10 again (clamped to the maximum), not 1.
  advance(460);
  expect(input.value).toBe("20");
  await user.pointer({ keys: "[/MouseLeft]", target: increment });
  await user.keyboard("{/Shift}");
});

test("the wheel steps while the input is focused", () => {
  const { getByLabelText } = mount(basic);
  const input = getByLabelText("Quantity") as HTMLInputElement;
  fireEvent.wheel(input, { deltaY: -100 });
  flush();
  expect(input.value).toBe("5");
  input.focus();
  fireEvent.wheel(input, { deltaY: -100 });
  flush();
  expect(input.value).toBe("6");
  fireEvent.wheel(input, { deltaY: 100, shiftKey: true });
  flush();
  expect(input.value).toBe("0");
});

/** A pointer move by `dx` px. jsdom's PointerEvent has no movementX, so it is set on the event. */
function moveBy(dx: number) {
  const event = new PointerEvent("pointermove", { bubbles: true, pointerId: 1 });
  Object.defineProperty(event, "movementX", { value: dx });
  Object.defineProperty(event, "movementY", { value: 0 });
  window.dispatchEvent(event);
  flush();
}

test("scrubbing: dragging across the scrub area steps per pixelSensitivity and commits on release", () => {
  const { getByLabelText, getByTestId, queryByTestId } = mount(basic);
  const input = getByLabelText("Quantity") as HTMLInputElement;
  const scrub = getByTestId("scrub");
  expect(queryByTestId("cursor")).toBeNull();
  fireEvent.pointerDown(scrub, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
  flush();
  expect(getByTestId("root").hasAttribute("data-scrubbing")).toBe(true);
  expect(getByTestId("cursor").style.transform).toBe("translate3d(100px, 100px, 0px)");
  moveBy(2);
  expect(input.value).toBe("5");
  moveBy(3);
  expect(input.value).toBe("8");
  expect(getByTestId("cursor").style.transform).toBe("translate3d(105px, 100px, 0px)");
  moveBy(-4);
  expect(input.value).toBe("4");
  fireEvent.pointerUp(window, { pointerId: 1 });
  flush();
  expect(getByTestId("root").hasAttribute("data-scrubbing")).toBe(false);
  expect(queryByTestId("cursor")).toBeNull();
  expect(getByTestId("commits").textContent).toBe("4:scrub");
});

test("controlled: shows what it is given", async () => {
  const { getByLabelText, getByTestId, user } = mount(basic);
  const input = getByLabelText("Controlled") as HTMLInputElement;
  input.focus();
  await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
  // The owner caps it at 10.
  expect(input.value).toBe("10");
  await user.click(getByTestId("controlled-increment"));
  expect(input.value).toBe("10");
});

test("disabled and read-only fields don't change", async () => {
  const { getByLabelText, getByTestId, user } = mount(basic);
  const disabled = getByLabelText("Disabled") as HTMLInputElement;
  expect(disabled.disabled).toBe(true);
  expect((getByTestId("disabled-increment") as HTMLButtonElement).disabled).toBe(true);
  expect(getByTestId("disabled").hasAttribute("data-disabled")).toBe(true);

  const readOnly = getByLabelText("Read only") as HTMLInputElement;
  expect(readOnly.readOnly).toBe(true);
  expect(getByTestId("readonly").hasAttribute("data-readonly")).toBe(true);
  readOnly.focus();
  await user.keyboard("{ArrowUp}");
  expect(readOnly.value).toBe("3");
  await user.click(getByTestId("readonly-increment"));
  expect(readOnly.value).toBe("3");
});

test("inside a field: labelled, described, required and validated by it", async () => {
  const { getByLabelText, getByTestId, getByRole, user } = mount(field);
  const input = getByLabelText("Age") as HTMLInputElement;
  expect(input.getAttribute("aria-describedby")).toBe(getByTestId("description").id);
  expect(getByTestId("increment").getAttribute("aria-controls")).toBe(input.id);

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(getByTestId("number-root").hasAttribute("data-invalid")).toBe(true);
  expect(getByTestId("error").textContent).not.toBe("");

  await user.type(input, "30");
  expect(input.hasAttribute("aria-invalid")).toBe(false);
  expect(getByTestId("number-root").hasAttribute("data-filled")).toBe(true);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("age=30");

  expect((getByLabelText("Locked") as HTMLInputElement).disabled).toBe(true);
});
