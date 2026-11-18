// Date Field in Chromium, Firefox and WebKit (fixtures/basic.rx): segments in the locale's order, typing through
// real key presses (and through `beforeinput` alone, as a phone keyboard sends it), stepping, moving, clearing,
// controlled and uncontrolled values, min/max, form submission and reset.
import { expect, test } from "vitest";
import { flush, mount } from "../test/browser.ts";
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

// A `beforeinput` alone, as a phone keyboard sends it, applied before the next.
function send(target: HTMLElement, inputType: string, data: string | null) {
  target.dispatchEvent(new InputEvent("beforeinput", { inputType, data, bubbles: true, cancelable: true }));
  flush();
}

function setup() {
  const mounted = mount(basic);
  const field = (id: string) => mounted.getByTestId(id);
  const changes = () => mounted.getByTestId("changes").textContent;
  return { ...mounted, field, changes };
}

test("segments follow the locale: month/day/year in en-US, day/month/year in en-GB", () => {
  const { field } = setup();
  expect(segments(field("us")).map((s) => s.dataset.type)).toEqual(["month", "day", "year"]);
  expect(segments(field("gb")).map((s) => s.dataset.type)).toEqual(["day", "month", "year"]);
  expect(shown(field("us"))).toBe("––/––/––––");
  expect(shown(field("gb"))).toBe("29/02/2024");
  const literals = field("us").querySelectorAll("[data-type=literal]");
  expect(literals).toHaveLength(2);
  for (const literal of literals) expect(literal.getAttribute("aria-hidden")).toBe("true");
});

test("each segment is a labelled spinbutton in a labelled group", () => {
  const { field, getByRole } = setup();
  expect(field("us").getAttribute("role")).toBe("group");
  const month = getByRole("spinbutton", { name: "Start date month" });
  expect(month.getAttribute("aria-valuemin")).toBe("1");
  expect(month.getAttribute("aria-valuemax")).toBe("12");
  expect(month.getAttribute("aria-valuenow")).toBeNull();
  expect(month.getAttribute("aria-valuetext")).toBe("Empty");
  expect(month.hasAttribute("data-placeholder")).toBe(true);
  expect(month.getAttribute("inputmode")).toBe("numeric");
  expect(month.getAttribute("contenteditable")).toBe("true");
  const day = getByRole("spinbutton", { name: "Birthday day" });
  expect(day.getAttribute("aria-valuenow")).toBe("29");
  expect(day.getAttribute("aria-valuetext")).toBe("29");
  expect(day.hasAttribute("data-placeholder")).toBe(false);
  const gbMonth = getByRole("spinbutton", { name: "Birthday month" });
  expect(gbMonth.getAttribute("aria-valuetext")).toBe("02 – February");
});

test("typing goes through every segment, moving on when one is complete", async () => {
  const { field, user, changes } = setup();
  const [month, day, year] = segments(field("us"));
  await user.click(month);
  expect(field("us-input").hasAttribute("data-focused")).toBe(true);
  await user.keyboard("1");
  // 1 could still become 10–12.
  expect(document.activeElement).toBe(month);
  await user.keyboard("1");
  expect(document.activeElement).toBe(day);
  // 4 can't take another digit in a day.
  await user.keyboard("4");
  expect(document.activeElement).toBe(year);
  expect(changes()).toBe("");
  await user.keyboard("2026");
  expect(shown(field("us"))).toBe("11/4/2026");
  // Each year typed on the way is a date, reported as WebKit's native input does.
  expect(changes()).toBe("0002-11-04 0020-11-04 0202-11-04 2026-11-04");
  expect(hidden(field("us")).value).toBe("2026-11-04");
  // The same elements throughout, so focus never moved off the field.
  expect(segments(field("us"))).toEqual([month, day, year]);
  expect(document.activeElement).toBe(year);
});

test("a typed digit that can't be the start of a longer number moves on at once", async () => {
  const { field, user } = setup();
  const [month, day] = segments(field("us"));
  await user.click(month);
  await user.keyboard("3");
  expect(month.textContent).toBe("3");
  expect(document.activeElement).toBe(day);
  // A leading zero waits for its second digit.
  await user.keyboard("0");
  expect(document.activeElement).toBe(day);
  await user.keyboard("7");
  expect(day.textContent).toBe("7");
});

test("arrow keys step with wrap, PageUp/PageDown step further, Home/End go to the ends", async () => {
  const { field, user } = setup();
  const [month, day, year] = segments(field("us"));
  await user.click(month);
  // An empty segment takes the placeholder value's (2026-11-17).
  await user.keyboard("{ArrowUp}");
  expect(month.textContent).toBe("11");
  await user.keyboard("{ArrowUp}{ArrowUp}");
  expect(month.textContent).toBe("1");
  await user.keyboard("{ArrowDown}");
  expect(month.textContent).toBe("12");
  await user.keyboard("{PageUp}");
  expect(month.textContent).toBe("2");
  await user.keyboard("{PageDown}");
  expect(month.textContent).toBe("12");
  await user.keyboard("{Home}");
  expect(month.textContent).toBe("1");
  await user.keyboard("{End}");
  expect(month.textContent).toBe("12");
  day.focus();
  await user.keyboard("{ArrowDown}");
  expect(day.textContent).toBe("17");
  await user.keyboard("{PageUp}");
  expect(day.textContent).toBe("24");
  year.focus();
  await user.keyboard("{ArrowUp}");
  expect(year.textContent).toBe("2026");
  await user.keyboard("{PageUp}");
  expect(year.textContent).toBe("2031");
});

test("Left and Right move between segments; Tab steps through them and on to the next field", async () => {
  const { field, user } = setup();
  const [month, day, year] = segments(field("us"));
  await user.click(month);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(day);
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(document.activeElement).toBe(year);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(day);
  await user.keyboard("{Tab}");
  expect(document.activeElement).toBe(year);
  await user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(document.activeElement).toBe(day);
  const [gbDay] = segments(field("gb"));
  year.focus();
  await user.keyboard("{Tab}");
  expect(document.activeElement).toBe(gbDay);
  // Focus has left the first field.
  expect(field("us-input").hasAttribute("data-focused")).toBe(false);
});

test("right to left, Left moves to the next segment in reading order", async () => {
  const { field, user } = setup();
  const [first, second] = segments(field("ar"));
  await user.click(first);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(second);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(first);
});

test("ar-EG shows and takes Arabic-Indic digits, and ASCII digits too", async () => {
  const { field, user } = setup();
  const root = field("ar");
  expect(segments(root).map((s) => s.dataset.type)).toEqual(["day", "month", "year"]);
  const [day, month, year] = segments(root);
  await user.click(day);
  await user.keyboard("١٧");
  expect(day.textContent).toBe("١٧");
  expect(document.activeElement).toBe(month);
  await user.keyboard("11");
  expect(month.textContent).toBe("١١");
  await user.keyboard("٢٠٢٦");
  expect(year.textContent).toBe("٢٠٢٦");
  expect(hidden(root).value).toBe("2026-11-17");
});

test("Backspace removes a digit, then empties the segment, then moves back", async () => {
  const { field, user, changes } = setup();
  const root = field("gb");
  const [day, month, year] = segments(root);
  await user.click(year);
  await user.keyboard("{Backspace}");
  expect(year.textContent).toBe("202");
  // 29 February 202 doesn't exist: the field is incomplete until the year is a leap year again.
  expect(hidden(root).value).toBe("");
  await user.keyboard("0");
  expect(hidden(root).value).toBe("2020-02-29");
  await user.keyboard("{Backspace}");
  await user.keyboard("{Backspace}{Backspace}{Backspace}");
  expect(year.hasAttribute("data-placeholder")).toBe(true);
  expect(hidden(root).value).toBe("");
  expect(document.activeElement).toBe(year);
  await user.keyboard("{Backspace}");
  expect(document.activeElement).toBe(month);
  await user.keyboard("{Delete}");
  expect(month.hasAttribute("data-placeholder")).toBe(true);
  expect(day.textContent).toBe("29");
  expect(changes()).toBe("");
});

test("a complete date that becomes incomplete reports undefined, once", async () => {
  const { field, user, changes } = setup();
  const [month] = segments(field("us"));
  await user.click(month);
  await user.keyboard("11172026");
  expect(changes()).toContain("2026-11-17");
  segments(field("us"))[1].focus();
  await user.keyboard("{Backspace}");
  expect(changes()).toMatch(/2026-11-17 2026-11-01$/);
  await user.keyboard("{Backspace}");
  expect(changes()).toMatch(/2026-11-01 none$/);
  await user.keyboard("{Backspace}");
  expect(changes()).toMatch(/2026-11-01 none$/);
});

test("the day is kept within the month when the month or year changes", async () => {
  const { field, user } = setup();
  const root = field("gb");
  const [day, month, year] = segments(root);
  // 29 February 2024, to 2025: 28 February.
  await user.click(year);
  await user.keyboard("{ArrowUp}");
  expect(shown(root)).toBe("28/02/2025");
  // 31 January, to April: 30.
  await user.click(month);
  await user.keyboard("01");
  await user.click(day);
  await user.keyboard("31");
  expect(shown(root)).toBe("31/01/2025");
  month.focus();
  await user.keyboard("{PageUp}{ArrowUp}");
  expect(shown(root)).toBe("30/04/2025");
  // February of a leap year has 29 days, of another 28.
  await user.keyboard("{Home}{ArrowUp}");
  expect(shown(root)).toBe("28/02/2025");
  expect(day.getAttribute("aria-valuemax")).toBe("28");
  year.focus();
  await user.keyboard("2028");
  expect(day.getAttribute("aria-valuemax")).toBe("29");
  day.focus();
  await user.keyboard("29");
  expect(shown(root)).toBe("29/02/2028");
  expect(hidden(root).value).toBe("2028-02-29");
});

test("a date outside min/max is kept and marks the field invalid", async () => {
  const { field, user } = setup();
  const root = field("gb");
  const [, , year] = segments(root);
  expect(root.hasAttribute("data-invalid")).toBe(false);
  await user.click(year);
  await user.keyboard("1999");
  expect(shown(root)).toBe("28/02/1999");
  expect(hidden(root).value).toBe("1999-02-28");
  expect(root.hasAttribute("data-invalid")).toBe(true);
  expect(year.getAttribute("aria-invalid")).toBe("true");
  expect(hidden(root).validity.rangeUnderflow).toBe(true);
  await user.keyboard("2031");
  expect(hidden(root).validity.rangeOverflow).toBe(true);
  await user.keyboard("2030");
  expect(root.hasAttribute("data-invalid")).toBe(false);
  expect(hidden(root).validity.valid).toBe(true);
});

test("a partly filled field is invalid until it is complete", async () => {
  const { field, user } = setup();
  const root = field("us");
  const [month] = segments(root);
  expect(hidden(root).validity.valid).toBe(true);
  await user.click(month);
  await user.keyboard("11");
  expect(hidden(root).validity.customError).toBe(true);
  expect(hidden(root).validationMessage).toBe("Enter a complete date.");
  await user.keyboard("172026");
  expect(hidden(root).validity.valid).toBe(true);
});

test("a press on the input's empty space focuses the first empty segment, or the last", async () => {
  const { field, user } = setup();
  const input = field("us-input");
  input.style.paddingInlineEnd = "40px";
  const [month, day, year] = segments(field("us"));
  const end = { x: input.getBoundingClientRect().width - 10, y: 5 };
  await user.click(input, { position: end });
  expect(document.activeElement).toBe(month);
  await user.keyboard("11");
  await user.click(input, { position: end });
  expect(document.activeElement).toBe(day);
  await user.keyboard("172026");
  await user.click(input, { position: end });
  expect(document.activeElement).toBe(year);
});

test("characters arriving only through beforeinput are typed, as a phone keyboard sends them", async () => {
  const { field, user } = setup();
  const root = field("us");
  const [month, day] = segments(root);
  await user.click(month);
  send(month, "insertText", "1");
  send(month, "insertText", "2");
  await expect.poll(() => month.textContent).toBe("12");
  expect(document.activeElement).toBe(day);
  send(day, "insertText", "5");
  await expect.poll(() => day.textContent).toBe("5");
  send(day, "deleteContentBackward", null);
  await expect.poll(() => day.hasAttribute("data-placeholder")).toBe(true);
  // Nothing the browser would have inserted reaches the element.
  expect(month.textContent).toBe("12");
});

test("text a composition wrote into a segment is put back", async () => {
  const { field, user } = setup();
  const [month] = segments(field("us"));
  await user.click(month);
  await user.keyboard("1");
  month.firstChild!.textContent = "1x";
  month.dispatchEvent(
    new InputEvent("input", { inputType: "insertCompositionText", data: "x", bubbles: true }),
  );
  expect(month.textContent).toBe("1");
  await user.keyboard("{ArrowUp}");
  expect(month.textContent).toBe("2");
});

test("pasting an ISO date fills every segment; other text is ignored", async () => {
  const { field, user } = setup();
  const root = field("us");
  const [month] = segments(root);
  await user.click(month);
  const paste = (text: string) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    // Firefox drops `clipboardData` from the constructor's options.
    const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: data });
    month.dispatchEvent(event);
  };
  paste("tomorrow");
  await expect.poll(() => shown(root)).toBe("––/––/––––");
  paste(" 2026-12-24 ");
  await expect.poll(() => shown(root)).toBe("12/24/2026");
  expect(hidden(root).value).toBe("2026-12-24");
});

test("controlled: the owner's value is shown, and a value set from outside replaces a partial edit", async () => {
  const { field, user, getByRole, getByTestId } = setup();
  const root = field("controlled");
  const [month, day, year] = segments(root);
  expect(shown(root)).toBe("11/17/2026");
  await user.click(day);
  await user.keyboard("20");
  expect(getByTestId("controlled-value").textContent).toBe("2026-11-20");
  await user.click(day);
  await user.keyboard("{Backspace}{Backspace}");
  // The owner now holds no date (undefined reported, null stored), and the edit stays.
  expect(getByTestId("controlled-value").textContent).toBe("none");
  expect(shown(root)).toBe("11/––/2026");
  await user.click(getByRole("button", { name: "Set 2030" }));
  expect(shown(root)).toBe("1/5/2030");
  await user.click(getByRole("button", { name: "Clear" }));
  expect(shown(root)).toBe("––/––/––––");
  await user.click(month);
  await user.keyboard("{ArrowUp}");
  expect(month.textContent).toBe(String(Temporal.Now.plainDateISO().month));
  expect(year.hasAttribute("data-placeholder")).toBe(true);
});

test("disabled: segments can't be focused or edited", async () => {
  const { field } = setup();
  const root = field("disabled");
  expect(root.hasAttribute("data-disabled")).toBe(true);
  expect(root.getAttribute("aria-disabled")).toBe("true");
  for (const segment of segments(root)) {
    expect(segment.hasAttribute("tabindex")).toBe(false);
    expect(segment.hasAttribute("contenteditable")).toBe(false);
    expect(segment.getAttribute("aria-disabled")).toBe("true");
  }
});

test("read-only: segments take focus but not edits", async () => {
  const { field, user } = setup();
  const root = field("readonly");
  const [month, day] = segments(root);
  expect(root.hasAttribute("data-readonly")).toBe(true);
  await user.click(month);
  expect(document.activeElement).toBe(month);
  expect(month.getAttribute("aria-readonly")).toBe("true");
  expect(month.hasAttribute("contenteditable")).toBe(false);
  await user.keyboard("{ArrowUp}5{Backspace}");
  expect(shown(root)).toBe("1/2/2026");
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(day);
});

test("the form submits the ISO date, nothing while incomplete, and reset restores the default", async () => {
  const { field, user, getByRole, getByTestId } = setup();
  const form = getByTestId("form") as HTMLFormElement;
  expect(new FormData(form).get("birthday")).toBe("2024-02-29");
  expect(new FormData(form).get("start")).toBe("");
  const [month] = segments(field("us"));
  await user.click(month);
  await user.keyboard("1117");
  expect(new FormData(form).get("start")).toBe("");
  await user.keyboard("2026");
  expect(new FormData(form).get("start")).toBe("2026-11-17");
  const [, , year] = segments(field("gb"));
  year.focus();
  await user.keyboard("2025");
  expect(new FormData(form).get("birthday")).toBe("2025-02-28");
  await user.click(getByRole("button", { name: "Reset" }));
  await expect.poll(() => shown(field("gb"))).toBe("29/02/2024");
  expect(shown(field("us"))).toBe("––/––/––––");
  expect(new FormData(form).get("birthday")).toBe("2024-02-29");
  expect(new FormData(form).get("start")).toBe("");
});

test("inside a Field: labelled and described by it, validated on submit, submitted by the Form", async () => {
  const { getByRole, getByTestId, user } = mount(fieldFixture);
  const root = getByTestId("due");
  expect(getByRole("group", { name: "Due date" })).toBe(root);
  const month = getByRole("spinbutton", { name: "Due date month" });
  expect(root.getAttribute("aria-describedby")).toBe(getByTestId("description").id);

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("");
  expect(root.hasAttribute("data-invalid")).toBe(true);
  expect(month.getAttribute("aria-invalid")).toBe("true");
  expect(getByTestId("error").textContent).not.toBe("");

  // Partly filled, then left: incomplete.
  await user.click(month);
  await user.keyboard("12");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("error").textContent).toBe("Enter a complete date.");
  expect(getByTestId("submitted").textContent).toBe("");

  // Before `min`: the browser's range message.
  await user.click(month);
  await user.keyboard("{ArrowRight}012025");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(hidden(root).validity.rangeUnderflow).toBe(true);
  expect(getByTestId("submitted").textContent).toBe("");

  const [, , year] = segments(root);
  year.focus();
  await user.keyboard("2026");
  expect(root.hasAttribute("data-invalid")).toBe(false);
  expect(root.hasAttribute("data-filled")).toBe(true);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("due=2026-12-01");

  const locked = getByTestId("locked");
  expect(locked.hasAttribute("data-disabled")).toBe(true);
  for (const segment of segments(locked)) expect(segment.hasAttribute("contenteditable")).toBe(false);
});

test("controlled: set and cleared from outside twice", async () => {
  const { field, user, getByRole } = setup();
  const root = field("controlled");
  for (let round = 0; round < 2; round++) {
    // oxlint-disable-next-line no-await-in-loop -- presses one after another, as a person makes them
    await user.click(getByRole("button", { name: "Set 2030" }));
    expect(shown(root)).toBe("1/5/2030");
    // oxlint-disable-next-line no-await-in-loop -- presses one after another, as a person makes them
    await user.click(getByRole("button", { name: "Clear" }));
    expect(shown(root)).toBe("––/––/––––");
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
