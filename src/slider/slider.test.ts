import { fireEvent } from "@testing-library/dom";
import { expect, test } from "vitest";
import { pushThumbs, roundToStep, thumbKeyValue } from "../internal/impl/slider.ts";
import { flush, mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import field from "./fixtures/field.rx";

/** jsdom has no layout: give an element a box, so pointer positions map to values. */
function stubRect(element: Element, left: number, top: number, width: number, height: number) {
  element.getBoundingClientRect = () => new DOMRect(left, top, width, height);
}

/** Fires a pointer event and applies what it changed. A move needs `buttons: 1`, as a pressed pointer has. */
function pointer(
  type: "pointerDown" | "pointerMove" | "pointerUp",
  element: Element | Document,
  init: object,
) {
  fireEvent[type](element, { pointerId: 1, button: 0, buttons: 1, ...init });
  flush();
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

test("step rounding, key steps and pushing are exact", () => {
  expect(roundToStep(0.30000000000000004, 0.1, 0)).toBe(0.3);
  expect(roundToStep(23, 5, 100)).toBe(25);
  expect(thumbKeyValue("ArrowUp", false, [0.7], 0, 0, 1, 0.1, 0.5, 0)).toBe(0.8);
  expect(thumbKeyValue("ArrowLeft", true, [50], 0, 0, 100, 1, 10, 0)).toBe(40);
  expect(thumbKeyValue("PageUp", false, [95], 0, 0, 100, 1, 10, 0)).toBe(100);
  expect(thumbKeyValue("End", false, [10, 50], 0, 0, 100, 5, 10, 2)).toBe(40);
  expect(thumbKeyValue("Home", false, [10, 50], 1, 0, 100, 5, 10, 2)).toBe(20);
  expect(thumbKeyValue("a", false, [10], 0, 0, 100, 1, 10, 0)).toBeNull();
  expect(pushThumbs([20, 40, 60], 0, 55, 0, 100, 5, 1)).toEqual([55, 60, 65]);
  // Moving back lets a pushed thumb return to where it started.
  expect(pushThumbs([55, 60, 65], 0, 10, 0, 100, 5, 1, [20, 40, 60])).toEqual([10, 40, 60]);
});

test("renders the value, the ARIA of a slider and the state attributes", () => {
  const { getByRole, getByTestId } = mount(basic);
  const input = getByRole("slider", { name: "Volume" }) as HTMLInputElement;
  expect(input.type).toBe("range");
  expect(input.value).toBe("30");
  expect(input.min).toBe("0");
  expect(input.max).toBe("100");
  expect(input.getAttribute("aria-valuenow")).toBe("30");
  expect(input.getAttribute("aria-orientation")).toBe("horizontal");
  expect(input.hasAttribute("aria-valuetext")).toBe(false);

  const root = getByTestId("single");
  expect(root.getAttribute("role")).toBe("group");
  expect(root.getAttribute("data-orientation")).toBe("horizontal");
  expect(getByTestId("single-value").textContent).toBe("30");
  expect(getByTestId("single-value").getAttribute("for")).toBe(input.id);
  expect(getByTestId("single-value").getAttribute("aria-live")).toBe("off");
  expect(getByTestId("single-thumb").getAttribute("data-index")).toBe("0");
  expect(getByTestId("single-thumb").style.insetInlineStart).toBe("30%");
  expect(getByTestId("single-indicator").style.width).toBe("30%");
});

test("a range formats its values, labels each thumb and fills between them", () => {
  const { getByRole, getByTestId } = mount(basic);
  const low = getByRole("slider", { name: "Minimum price" });
  const high = getByRole("slider", { name: "Maximum price" });
  expect(low.getAttribute("aria-valuetext")).toBe("$120 start range");
  expect(high.getAttribute("aria-valuetext")).toBe("$180 end range");
  expect(getByTestId("range-value").textContent).toBe("$120 – $180");
  expect(getByTestId("range-value").getAttribute("for")).toBe(`${low.id} ${high.id}`);
  expect(getByTestId("range-indicator").style.insetInlineStart).toBe("20%");
  expect(getByTestId("range-indicator").style.width).toBe("60%");
});

test("the thumb's ARIA props go to its input", () => {
  const { getByRole, getByTestId } = mount(basic);
  const input = getByRole("slider", { name: "Opacity" });
  expect(input.getAttribute("aria-describedby")).toBe("opacity-help");
  expect(getByTestId("vertical-thumb").hasAttribute("aria-describedby")).toBe(false);
  expect(getByTestId("vertical-thumb").hasAttribute("aria-label")).toBe(false);
});

test("arrow, Page, Home and End keys step the value; Shift takes the large step", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("slider", { name: "Volume" }) as HTMLInputElement;
  input.focus();
  await user.keyboard("{ArrowRight}");
  expect(input.value).toBe("31");
  await user.keyboard("{ArrowUp}");
  expect(input.value).toBe("32");
  await user.keyboard("{ArrowLeft}{ArrowDown}{ArrowDown}");
  expect(input.value).toBe("29");
  await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
  expect(input.value).toBe("39");
  await user.keyboard("{PageUp}");
  expect(input.value).toBe("49");
  await user.keyboard("{PageDown}{PageDown}");
  expect(input.value).toBe("29");
  await user.keyboard("{End}");
  expect(input.value).toBe("100");
  await user.keyboard("{ArrowRight}");
  expect(input.value).toBe("100");
  await user.keyboard("{Home}");
  expect(input.value).toBe("0");
  expect(getByTestId("single-value").textContent).toBe("0");
  expect(getByTestId("changes").textContent).toBe(
    "31:keyboard 32:keyboard 31:keyboard 30:keyboard 29:keyboard 39:keyboard 49:keyboard 39:keyboard 29:keyboard 100:keyboard 0:keyboard",
  );
  // Each key press is final: committed as it changes, and not when nothing changed.
  expect(getByTestId("commits").textContent).toBe(getByTestId("changes").textContent);
});

test("vertical: arrows step by a decimal step without float noise", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("slider", { name: "Opacity" }) as HTMLInputElement;
  expect(input.getAttribute("aria-orientation")).toBe("vertical");
  expect(getByTestId("vertical").getAttribute("data-orientation")).toBe("vertical");
  expect(getByTestId("vertical").hasAttribute("orientation")).toBe(false);
  expect(input.getAttribute("aria-valuetext")).toBe("0.5 opaque");
  input.focus();
  await user.keyboard("{ArrowUp}{ArrowUp}");
  expect(input.value).toBe("0.7");
  await user.keyboard("{ArrowDown}");
  expect(input.value).toBe("0.6");
  await user.keyboard("{PageDown}");
  expect(input.value).toBe("0.1");
  expect(getByTestId("vertical-indicator").style.height).toBe("10%");
});

test("a range thumb stops short of its neighbour by minStepsBetweenValues", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const low = getByRole("slider", { name: "Minimum price" }) as HTMLInputElement;
  const high = getByRole("slider", { name: "Maximum price" }) as HTMLInputElement;
  low.focus();
  await user.keyboard("{End}");
  expect(low.value).toBe("170");
  // One more step would bring it within two steps of the other thumb.
  await user.keyboard("{ArrowRight}");
  expect(low.value).toBe("170");
  high.focus();
  await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
  expect(high.value).toBe("200");
  await user.keyboard("{Home}");
  expect(high.value).toBe("180");
  expect(getByTestId("changes").textContent).toBe(
    "[170,180]:keyboard:0 [170,200]:keyboard:1 [170,180]:keyboard:1",
  );
});

test("pressing the track moves the thumb there; dragging follows the pointer; release commits", async () => {
  const { getByRole, getByTestId } = mount(basic);
  const control = getByTestId("single-control");
  const input = getByRole("slider", { name: "Volume" });
  stubRect(control, 0, 0, 200, 20);
  stubRect(getByTestId("single-thumb"), 50, 0, 20, 20);

  pointer("pointerDown", control, { clientX: 100, clientY: 10 });
  expect(input.getAttribute("aria-valuenow")).toBe("50");
  expect(getByTestId("single").hasAttribute("data-dragging")).toBe(true);
  expect(getByTestId("single-thumb").hasAttribute("data-dragging")).toBe(true);
  pointer("pointerMove", document, { clientX: 150, clientY: 10 });
  expect(input.getAttribute("aria-valuenow")).toBe("75");
  // Past the end: clamped to the maximum.
  pointer("pointerMove", document, { clientX: 400, clientY: 10 });
  expect(input.getAttribute("aria-valuenow")).toBe("100");
  expect(getByTestId("commits").textContent).toBe("");
  pointer("pointerUp", document, { clientX: 400, clientY: 10, buttons: 0 });
  expect(getByTestId("single").hasAttribute("data-dragging")).toBe(false);
  expect(getByTestId("changes").textContent).toBe("50:track-press 75:drag 100:drag");
  expect(getByTestId("commits").textContent).toBe("100:drag");

  // The press focuses the thumb's input, a frame later.
  await nextFrame();
  expect(document.activeElement).toBe(input);

  // After release, moving the pointer changes nothing.
  pointer("pointerMove", document, { clientX: 20, clientY: 10 });
  expect(input.getAttribute("aria-valuenow")).toBe("100");
});

test("dragging a thumb keeps where it was grabbed", () => {
  const { getByRole, getByTestId } = mount(basic);
  const control = getByTestId("single-control");
  const thumb = getByTestId("single-thumb");
  stubRect(control, 0, 0, 200, 20);
  // The thumb is centred at x = 60 (value 30).
  stubRect(thumb, 50, 0, 20, 20);
  // Grabbed 6px right of its centre: pressing it doesn't move it.
  pointer("pointerDown", thumb, { clientX: 66, clientY: 10 });
  expect(getByRole("slider", { name: "Volume" }).getAttribute("aria-valuenow")).toBe("30");
  pointer("pointerMove", document, { clientX: 86, clientY: 10 });
  expect(getByRole("slider", { name: "Volume" }).getAttribute("aria-valuenow")).toBe("40");
  pointer("pointerUp", document, { buttons: 0 });
  expect(getByTestId("commits").textContent).toBe("40:drag");
});

test("in a range, the nearest thumb moves and pushes the other past minStepsBetweenValues", () => {
  const { getByTestId, getByRole } = mount(basic);
  const control = getByTestId("range-control");
  stubRect(control, 0, 0, 100, 10);
  // Values 120 and 180 of 100–200: centres at 20 and 80.
  stubRect(getByTestId("range-thumb-0"), 15, 0, 10, 10);
  stubRect(getByTestId("range-thumb-1"), 75, 0, 10, 10);
  const low = getByRole("slider", { name: "Minimum price" });
  const high = getByRole("slider", { name: "Maximum price" });

  pointer("pointerDown", control, { clientX: 70, clientY: 5 });
  expect(high.getAttribute("aria-valuenow")).toBe("170");
  expect(low.getAttribute("aria-valuenow")).toBe("120");
  // Dragged down to 120: pushes the low thumb to stay 2 steps (10) below.
  pointer("pointerMove", document, { clientX: 20, clientY: 5 });
  expect(high.getAttribute("aria-valuenow")).toBe("120");
  expect(low.getAttribute("aria-valuenow")).toBe("110");
  // Back up: the pushed thumb returns to where it started.
  pointer("pointerMove", document, { clientX: 60, clientY: 5 });
  expect(low.getAttribute("aria-valuenow")).toBe("120");
  expect(high.getAttribute("aria-valuenow")).toBe("160");
  pointer("pointerUp", document, { buttons: 0 });
  expect(getByTestId("changes").textContent).toBe(
    "[120,170]:track-press:1 [110,120]:drag:1 [120,160]:drag:1",
  );
});

test("vertical: the bottom of the control is the minimum", () => {
  const { getByTestId, getByRole } = mount(basic);
  const control = getByTestId("vertical-control");
  stubRect(control, 0, 0, 10, 100);
  pointer("pointerDown", control, { clientX: 5, clientY: 80 });
  expect(getByRole("slider", { name: "Opacity" }).getAttribute("aria-valuenow")).toBe("0.2");
  pointer("pointerUp", document, { buttons: 0 });
});

test("controlled: shows the value it is given", async () => {
  const { getByRole, user } = mount(basic);
  const input = getByRole("slider", { name: "Controlled" }) as HTMLInputElement;
  expect(input.value).toBe("40");
  input.focus();
  // The owner answers any change with 50.
  await user.keyboard("{ArrowRight}");
  expect(input.value).toBe("50");
  await user.keyboard("{ArrowRight}");
  expect(input.value).toBe("50");
});

test("disabled: no keys, no pointer, disabled input", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("slider", { name: "Locked" }) as HTMLInputElement;
  expect(input.disabled).toBe(true);
  expect(getByTestId("disabled").hasAttribute("data-disabled")).toBe(true);
  const control = getByTestId("disabled-control");
  stubRect(control, 0, 0, 100, 10);
  pointer("pointerDown", control, { clientX: 80, clientY: 5 });
  pointer("pointerUp", document, { buttons: 0 });
  expect(input.value).toBe("10");
  await user.keyboard("{ArrowRight}");
  expect(input.value).toBe("10");
});

test("submits each thumb's value with the form, inside a range other than 0–100", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const form = getByTestId("form") as HTMLFormElement;
  expect(new FormData(form).get("volume")).toBe("30");
  expect(new FormData(form).getAll("price")).toEqual(["120", "180"]);
  getByRole("slider", { name: "Maximum price" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(new FormData(form).getAll("price")).toEqual(["120", "185"]);
});

test("inside a field: labelled, described, disabled and validated by it", async () => {
  const { getByRole, getByTestId, user } = mount(field);
  const input = getByRole("slider", { name: "Brightness" }) as HTMLInputElement;
  expect(input.getAttribute("aria-describedby")).toBe(getByTestId("description").id);
  expect(getByTestId("slider-root").getAttribute("aria-labelledby")).toBe(getByTestId("label").id);
  expect(new FormData(getByTestId("form") as HTMLFormElement).get("brightness")).toBe("20");

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("error").textContent).toBe("Too dim");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(getByTestId("slider-root").hasAttribute("data-invalid")).toBe(true);

  input.focus();
  await user.keyboard("{PageUp}{PageUp}{PageUp}");
  expect(input.value).toBe("50");
  expect(input.hasAttribute("aria-invalid")).toBe(false);
  expect(getByTestId("slider-root").hasAttribute("data-dirty")).toBe(true);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("brightness=50");

  expect((getByRole("slider", { name: "Locked" }) as HTMLInputElement).disabled).toBe(true);
});
