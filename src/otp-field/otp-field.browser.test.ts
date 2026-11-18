// OTP fields in Chromium, Firefox and WebKit (fixtures/basic.rx): typing, the keys, a real paste, a fill, form
// submission, validation and reset. An IME composition can't be produced by Playwright, so that test dispatches the
// events an engine sends.
import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";

// The slots of the field whose first slot has this id.
function slots(id: string): HTMLInputElement[] {
  return [
    ...document
      .getElementById(id)!
      .closest('[role="group"]')!
      .querySelectorAll<HTMLInputElement>("[data-bisque-otp-slot]"),
  ];
}

function values(id: string): string {
  return slots(id)
    .map((slot) => slot.value)
    .join("");
}

// The hidden input that holds the code `name` for the form.
function hidden(name: string): HTMLInputElement {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
}

function setup() {
  const mounted = mount(basic);
  const text = (testId: string) => mounted.getByTestId(testId).textContent;
  return { ...mounted, text };
}

// Slot ids are set once the field has found its slots (a microtask after mounting).
async function ready() {
  await frame();
}

test("renders a group of native text inputs, one per character, and a hidden input for the form", async () => {
  const { getByTestId, getByText } = setup();
  await ready();
  const code = slots("code");
  expect(code).toHaveLength(6);
  expect(code.map((slot) => slot.id)).toEqual(["code", "code-2", "code-3", "code-4", "code-5", "code-6"]);
  expect(code.map((slot) => slot.type)).toEqual(Array(6).fill("text"));
  expect(code.map((slot) => slot.getAttribute("inputmode"))).toEqual(Array(6).fill("numeric"));
  expect(code.map((slot) => slot.getAttribute("autocomplete"))).toEqual([
    "one-time-code",
    "off",
    "off",
    "off",
    "off",
    "off",
  ]);
  expect(code.map((slot) => slot.maxLength)).toEqual([6, -1, -1, -1, -1, -1]);
  expect(code.map((slot) => slot.getAttribute("pattern"))).toEqual(Array(6).fill("\\d{1}"));
  expect(code.map((slot) => slot.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
  expect(code.map((slot) => slot.getAttribute("enterkeyhint"))).toEqual([
    "next",
    "next",
    "next",
    "next",
    "next",
    "done",
  ]);
  const root = getByTestId("root");
  expect(root.getAttribute("role")).toBe("group");
  const label = getByText("Code");
  expect(label.id).not.toBe("");
  expect(root.getAttribute("aria-labelledby")).toBe(label.id);
  // Every slot is labelled by the code's label, but one given its own aria-label keeps it; the first can't.
  expect(code.map((slot) => slot.getAttribute("aria-labelledby"))).toEqual([
    label.id,
    null,
    label.id,
    label.id,
    label.id,
    label.id,
  ]);
  expect(code[1].getAttribute("aria-label")).toBe("Character 2 of 6");
  expect(code[0].hasAttribute("aria-label")).toBe(false);
  expect(code[0].labels?.[0]).toBe(label);
  const input = hidden("code");
  expect(input.type).toBe("text");
  expect(input.getAttribute("aria-hidden")).toBe("true");
  expect(input.tabIndex).toBe(-1);
  expect(input.pattern).toBe("\\d{6}");
  expect(input.minLength).toBe(6);
  expect(input.maxLength).toBe(6);
  expect(input.required).toBe(true);
  expect(getByTestId("separator").getAttribute("role")).toBe("separator");
});

test("typing fills one slot after another, and the last one completes the code", async () => {
  const { text, getByTestId, user } = setup();
  await ready();
  const code = slots("code");
  const root = getByTestId("root");
  // A press on a slot past the first empty one goes to the first empty one.
  await user.click(code[3]);
  expect(document.activeElement).toBe(code[0]);
  expect(root.hasAttribute("data-focused")).toBe(true);
  await user.keyboard("12345");
  expect(values("code")).toBe("12345");
  expect(document.activeElement).toBe(code[5]);
  expect(root.hasAttribute("data-filled")).toBe(true);
  expect(root.hasAttribute("data-complete")).toBe(false);
  expect(code[4].hasAttribute("data-filled")).toBe(true);
  expect(code[5].hasAttribute("data-filled")).toBe(false);
  // The focused slot is the group's one tab stop.
  expect(code.map((slot) => slot.tabIndex)).toEqual([-1, -1, -1, -1, -1, 0]);
  await user.keyboard("6");
  expect(values("code")).toBe("123456");
  // Typing into the last slot keeps focus there, with its character selected.
  expect(document.activeElement).toBe(code[5]);
  await expect.poll(() => [code[5].selectionStart, code[5].selectionEnd]).toEqual([0, 1]);
  expect(root.hasAttribute("data-complete")).toBe(true);
  expect(code.every((slot) => slot.hasAttribute("data-complete"))).toBe(true);
  expect(text("changes")).toBe(
    "1:input-change 12:input-change 123:input-change 1234:input-change 12345:input-change 123456:input-change",
  );
  await expect.poll(() => text("completes")).toBe("123456:input-change");
  expect(hidden("code").value).toBe("123456");
  expect(new FormData(getByTestId("form") as HTMLFormElement).get("code")).toBe("123456");
  await user.keyboard("{Tab}");
  expect(root.hasAttribute("data-focused")).toBe(false);
});

test("a character the slot doesn't take is dropped and reported", async () => {
  const { text, user } = setup();
  await ready();
  const code = slots("code");
  await user.click(code[0]);
  await user.keyboard("a");
  expect(values("code")).toBe("");
  expect(document.activeElement).toBe(code[0]);
  expect(text("changes")).toBe("");
  await expect.poll(() => text("invalids")).toBe("a:input-change");
  await user.keyboard("1");
  await user.click(code[0]);
  // A filled slot keeps its character, selected, when the key is refused.
  await user.keyboard("b");
  expect(values("code")).toBe("1");
  expect(document.activeElement).toBe(code[0]);
  expect([code[0].selectionStart, code[0].selectionEnd]).toEqual([0, 1]);
});

test("typing over a selected character replaces it and moves on; the same character just moves on", async () => {
  const { text, user } = setup();
  await ready();
  const code = slots("code");
  await user.click(code[0]);
  await user.keyboard("1234");
  await user.click(code[1]);
  expect(document.activeElement).toBe(code[1]);
  await user.keyboard("9");
  expect(values("code")).toBe("1934");
  expect(document.activeElement).toBe(code[2]);
  await user.keyboard("3");
  expect(values("code")).toBe("1934");
  expect(document.activeElement).toBe(code[3]);
  expect(text("changes")?.split(" ").at(-1)).toBe("1934:input-change");
});

test("Backspace empties the slot (or the one before, from an empty slot) and moves back", async () => {
  const { text, user } = setup();
  await ready();
  const code = slots("code");
  await user.click(code[0]);
  await user.keyboard("1234");
  expect(document.activeElement).toBe(code[4]);
  await user.keyboard("{Backspace}");
  expect(values("code")).toBe("123");
  expect(document.activeElement).toBe(code[3]);
  await user.click(code[1]);
  await user.keyboard("{Backspace}");
  // The characters after it close the gap.
  expect(values("code")).toBe("13");
  expect(document.activeElement).toBe(code[0]);
  await user.keyboard("{Backspace}");
  expect(values("code")).toBe("3");
  expect(document.activeElement).toBe(code[0]);
  expect(text("changes")?.split(" ").slice(-3)).toEqual(["123:keyboard", "13:keyboard", "3:keyboard"]);
  // Backspace on an empty first slot changes nothing.
  await user.keyboard("{Backspace}");
  await user.keyboard("{Backspace}");
  expect(values("code")).toBe("");
  expect(text("changes")?.split(" ").at(-1)).toBe(":keyboard");
});

test("Delete takes the slot's character out and keeps focus on it; Ctrl+Backspace clears the code", async () => {
  const { user } = setup();
  await ready();
  const code = slots("code");
  await user.click(code[0]);
  await user.keyboard("1234");
  await user.click(code[1]);
  await user.keyboard("{Delete}");
  expect(values("code")).toBe("134");
  expect(document.activeElement).toBe(code[1]);
  await expect.poll(() => [code[1].selectionStart, code[1].selectionEnd]).toEqual([0, 1]);
  await user.keyboard("{Control>}{Backspace}{/Control}");
  expect(values("code")).toBe("");
  expect(document.activeElement).toBe(code[0]);
});

test("the arrow keys, Home and End move between slots, never past the first empty one", async () => {
  const { user } = setup();
  await ready();
  const code = slots("code");
  await user.click(code[0]);
  await user.keyboard("123");
  expect(document.activeElement).toBe(code[3]);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(code[2]);
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(code[0]);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(code[0]);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(code[1]);
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(code[3]);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(code[3]);
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(code[0]);
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(code[3]);
  await user.keyboard("{Control>}{ArrowLeft}{/Control}");
  expect(document.activeElement).toBe(code[0]);
  await user.keyboard("{Control>}{ArrowRight}{/Control}");
  expect(document.activeElement).toBe(code[3]);
});

test("right to left, the arrow keys swap", async () => {
  const { user } = setup();
  await ready();
  const rtl = slots("rtl");
  await user.click(rtl[0]);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(rtl[1]);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(rtl[0]);
});

test("Tab leaves the group from the slot that has focus", async () => {
  const { user } = setup();
  await ready();
  const code = slots("code");
  await user.click(code[0]);
  await user.keyboard("12");
  await user.keyboard("{Tab}");
  // The next code's tab stop: its last slot, as it is complete.
  expect(document.activeElement).toBe(slots("preset")[1]);
  await user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(document.activeElement).toBe(code[2]);
});

test("a pasted code is stripped of what isn't a digit and spread from the slot it lands in", async () => {
  const { text, getByLabelText, user } = setup();
  await ready();
  const code = slots("code");
  const source = getByLabelText("Source") as HTMLInputElement;
  await user.fill(source, "12 34-56");
  source.select();
  await user.copy();
  await user.click(code[0]);
  await user.paste();
  expect(values("code")).toBe("123456");
  expect(document.activeElement).toBe(code[5]);
  expect(text("changes")).toBe("123456:input-paste");
  await expect.poll(() => text("completes")).toBe("123456:input-paste");
  await expect.poll(() => text("invalids")).toBe("12 34-56:input-paste");
  // The same code pasted again changes nothing, and still completes.
  await user.click(code[0]);
  await user.paste();
  expect(text("changes")).toBe("123456:input-paste");
  await expect.poll(() => text("completes")).toBe("123456:input-paste 123456:input-paste");
  // Pasted over a complete code from a middle slot, it replaces from there.
  await user.fill(source, "99");
  source.select();
  await user.copy();
  await user.click(code[2]);
  await user.paste();
  expect(values("code")).toBe("129956");
  expect(document.activeElement).toBe(code[4]);
});

test("a whole code filled into the first slot (an SMS code, typed fast) is spread over the slots", async () => {
  const { user } = setup();
  await ready();
  const code = slots("code");
  await user.fill(code[0], "654321");
  await expect.poll(() => values("code")).toBe("654321");
  await expect.poll(() => document.activeElement).toBe(code[5]);
});

test("a password manager's fill of the hidden input is spread over the slots, and focusing it focuses a slot", async () => {
  const { text } = setup();
  await ready();
  const code = slots("code");
  const input = hidden("code");
  input.focus();
  expect(document.activeElement).toBe(code[0]);
  input.value = "12a34b56";
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText" }));
  await expect.poll(() => values("code")).toBe("123456");
  expect(document.activeElement).toBe(code[5]);
  expect(input.value).toBe("123456");
  expect(text("changes")).toBe("123456:input-change");
  await expect.poll(() => text("invalids")).toBe("12a34b56:input-change");
  input.value = "";
  input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  await expect.poll(() => values("code")).toBe("");
  await expect.poll(() => document.activeElement).toBe(code[0]);
});

test("a required code blocks the form's submission until it is complete, then submits under its name", async () => {
  const { text, getByTestId, getByRole, user } = setup();
  await ready();
  const code = slots("code");
  const form = getByTestId("form") as HTMLFormElement;
  let submitted: FormDataEntryValue | null = null;
  form.addEventListener("submit", () => {
    submitted = new FormData(form).get("code");
  });
  expect(form.checkValidity()).toBe(false);
  await user.click(code[0]);
  await user.keyboard("123");
  expect(form.checkValidity()).toBe(false);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(text("submits")).toBe("0");
  // The browser points at the first empty slot.
  expect(document.activeElement).toBe(code[3]);
  await user.click(code[0]);
  await user.keyboard("{End}456");
  expect(form.checkValidity()).toBe(true);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(text("submits")).toBe("1");
  expect(submitted).toBe("123456");
});

test("a form reset puts each code back to its default", async () => {
  const { text, getByRole, user } = setup();
  await ready();
  const code = slots("code");
  await user.click(code[0]);
  await user.keyboard("12");
  await user.click(getByRole("button", { name: "Reset" }));
  await expect.poll(() => values("code")).toBe("");
  expect(hidden("code").value).toBe("");
  expect(text("changes")?.split(" ").at(-1)).toBe(":input-clear");
  // A code left at its default shows it again: the browser emptied its slots too.
  await expect.poll(() => values("preset")).toBe("42");
  expect(hidden("preset").value).toBe("42");
  await user.click(code[0]);
  await user.keyboard("7");
  expect(values("code")).toBe("7");
});

test("controlled: shows the owner's value, and a value cleared under focus sends focus to the first slot", async () => {
  const { text, getByRole, user } = setup();
  await ready();
  const controlled = slots("controlled");
  expect(values("controlled")).toBe("12");
  await user.click(controlled[3]);
  expect(document.activeElement).toBe(controlled[2]);
  await user.keyboard("3");
  expect(text("controlled")).toBe("123");
  expect(values("controlled")).toBe("123");
  getByRole("button", { name: "Fill" }).click();
  await expect.poll(() => values("controlled")).toBe("9876");
  controlled[3].focus();
  // Cleared by its owner while a slot past the first has focus.
  getByRole("button", { name: "Clear" }).click();
  await expect.poll(() => values("controlled")).toBe("");
  await expect.poll(() => document.activeElement).toBe(controlled[0]);
  expect(controlled.map((slot) => slot.tabIndex)).toEqual([0, -1, -1, -1]);
  await user.keyboard("5");
  expect(values("controlled")).toBe("5");
  expect(document.activeElement).toBe(controlled[1]);
});

test("controlled: cleared while focus is elsewhere, focus stays where it is", async () => {
  const { getByRole, user } = setup();
  await ready();
  const clear = getByRole("button", { name: "Clear" });
  clear.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => values("controlled")).toBe("");
  expect(document.activeElement).toBe(clear);
  expect(slots("controlled")[0].tabIndex).toBe(0);
});

test("an owner that doesn't take the change: the slot keeps its text and focus stays, even when a later value comes", async () => {
  const { getByRole, user } = setup();
  await ready();
  const refused = slots("refused");
  await user.click(refused[0]);
  await user.keyboard("1");
  expect(values("refused")).toBe("");
  expect(document.activeElement).toBe(refused[0]);
  getByRole("button", { name: "Apply" }).click();
  await expect.poll(() => values("refused")).toBe("5");
  await frame();
  expect(document.activeElement).toBe(refused[0]);
});

test("a validation type and a normalisation: letters and digits, upper-cased", async () => {
  const { user } = setup();
  await ready();
  const letters = slots("letters");
  expect(letters[0].getAttribute("inputmode")).toBe("text");
  expect(letters[0].getAttribute("pattern")).toBe("[a-zA-Z0-9]{1}");
  await user.click(letters[0]);
  await user.keyboard("a-b1");
  expect(values("letters")).toBe("AB1");
  expect(document.activeElement).toBe(letters[3]);
});

test("disabled: every slot is disabled and nothing changes", async () => {
  const { getByTestId } = setup();
  await ready();
  const disabled = slots("disabled");
  expect(disabled.every((slot) => slot.disabled)).toBe(true);
  expect(getByTestId("disabled-root").hasAttribute("data-disabled")).toBe(true);
  expect(values("disabled")).toBe("12");
  expect(document.querySelector<HTMLInputElement>("#disabled-hidden-input")?.disabled).toBe(true);
});

test("read-only: the slots take focus and the arrow keys, not edits or a paste", async () => {
  const { getByTestId, getByLabelText, user } = setup();
  await ready();
  const readonly = slots("readonly");
  expect(readonly.every((slot) => slot.readOnly)).toBe(true);
  expect(getByTestId("readonly-root").hasAttribute("data-readonly")).toBe(true);
  await user.click(readonly[0]);
  expect(document.activeElement).toBe(readonly[0]);
  expect(getByTestId("readonly-root").hasAttribute("data-focused")).toBe(true);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(readonly[1]);
  await user.keyboard("{Backspace}{Delete}9");
  expect(values("readonly")).toBe("12");
  const source = getByLabelText("Source") as HTMLInputElement;
  await user.fill(source, "999");
  source.select();
  await user.copy();
  await user.click(readonly[0]);
  await user.paste();
  expect(values("readonly")).toBe("12");
});

// Writes `text` into the hidden input of the unnamed field `id`, as a password manager's fill would.
function fillHidden(id: string, text: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`#${id}-hidden-input`)!;
  input.value = text;
  input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  return input;
}

test("a fill of the hidden input changes nothing while read-only or disabled", async () => {
  setup();
  await ready();
  const readonly = fillHidden("readonly", "99");
  fillHidden("disabled", "99");
  await frame();
  expect(values("readonly")).toBe("12");
  expect(values("disabled")).toBe("12");
  // The read-only hidden input is put back; a disabled one isn't submitted, and only a script can write to it.
  expect(readonly.value).toBe("12");
});

test("mask makes the slots password inputs; a slot's own type wins", async () => {
  setup();
  await ready();
  expect(slots("masked").map((slot) => slot.type)).toEqual(["password", "text"]);
});

test("autoSubmit submits the form once the code is complete", async () => {
  const { text, user } = setup();
  await ready();
  const auto = slots("auto");
  await user.click(auto[0]);
  await user.keyboard("12");
  expect(text("auto-submits")).toBe("0");
  await user.keyboard("3");
  await expect.poll(() => text("auto-submits")).toBe("1");
});

test("autoSubmit with `form` submits the form it names, not the one around it", async () => {
  const { text, user } = setup();
  await ready();
  const external = slots("external");
  const form = document.getElementById("external-form") as HTMLFormElement;
  let submitted: FormDataEntryValue | null = null;
  form.addEventListener("submit", () => {
    submitted = new FormData(form).get("external");
  });
  await user.click(external[0]);
  await user.keyboard("12");
  await expect.poll(() => text("external-submits")).toBe("1");
  expect(submitted).toBe("12");
});

test("an IME composition is entered once, when it ends (dispatched events)", async () => {
  const { user } = setup();
  await ready();
  const letters = slots("letters");
  await user.click(letters[0]);
  const first = letters[0];
  const typeComposed = (value: string) => {
    first.value = value;
    first.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true, data: value }));
  };
  first.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  await frame();
  typeComposed("d");
  await frame();
  typeComposed("dd");
  await frame();
  typeComposed("ddd");
  await frame();
  // Shown as it is while composing, nothing entered yet.
  expect(letters.map((slot) => slot.value)).toEqual(["ddd", "", "", ""]);
  first.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }));
  await frame();
  expect(values("letters")).toBe("ddd");
  first.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "ddd" }));
  await expect.poll(() => letters.map((slot) => slot.value)).toEqual(["D", "D", "D", ""]);
  await expect.poll(() => document.activeElement).toBe(letters[3]);
});
