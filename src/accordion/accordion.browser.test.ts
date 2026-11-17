import { expect, test } from "vitest";
import { flush, frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import multiple from "./fixtures/multiple.rx";

const details = (el: HTMLElement) => el as HTMLDetailsElement;
const trigger = (getByText: (text: string) => HTMLElement, text: string) =>
  getByText(text).closest("summary")!;

test("items are <details> sharing a name, with summaries labelling region panels", () => {
  const { getByTestId, getByText } = mount(basic);
  const one = details(getByTestId("item-one"));
  const two = details(getByTestId("item-two"));
  const panel = getByTestId("panel-one");
  const summary = trigger(getByText, "One");
  expect(one.tagName).toBe("DETAILS");
  expect(one.open).toBe(true);
  expect(two.open).toBe(false);
  expect(one.name).not.toBe("");
  expect(two.name).toBe(one.name);
  expect(summary.parentElement).toBe(one);
  expect(panel.getAttribute("role")).toBe("region");
  expect(panel.getAttribute("aria-labelledby")).toBe(summary.id);
  expect(getByTestId("panel-two").checkVisibility()).toBe(false);
  expect(getByTestId("root").getAttribute("data-orientation")).toBe("vertical");
  expect(getByTestId("root").className).toBe("mine");
  expect(one.hasAttribute("data-open")).toBe(false);
});

test("opening one item closes the other, with one value change", async () => {
  const { getByTestId, getByText, user } = mount(basic);
  const one = details(getByTestId("item-one"));
  const two = details(getByTestId("item-two"));
  await user.click(trigger(getByText, "Two"));
  expect(two.open).toBe(true);
  // The browser closes the other item of the same name, at once.
  expect(one.open).toBe(false);
  expect(getByTestId("opened").textContent).toBe("two open");
  // Let the browser's toggle events arrive (Firefox delivers them late): they change nothing more.
  await frame();
  await frame();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(getByTestId("changes").textContent).toBe("two");

  await user.click(trigger(getByText, "Two"));
  await expect.poll(() => two.open).toBe(false);
  expect(getByTestId("changes").textContent).toBe("two,");
  expect(getByTestId("opened").textContent).toBe("two closed");
});

test("closing an item with its trigger animates the panel out first", async () => {
  const { getByTestId, getByText, user } = mount(basic);
  const one = details(getByTestId("item-one"));
  const panel = getByTestId("panel-one");
  await expect.poll(() => panel.style.getPropertyValue("--accordion-panel-height")).toBe("auto");
  await user.click(trigger(getByText, "One"));
  expect(panel.hasAttribute("data-ending-style")).toBe(true);
  expect(one.open).toBe(true);
  await frame();
  await frame();
  const height = panel.getBoundingClientRect().height;
  expect(height).toBeGreaterThan(0);
  expect(height).toBeLessThan(80);
  await expect.poll(() => one.open).toBe(false);
  expect(panel.hasAttribute("data-ending-style")).toBe(false);
  expect(panel.style.getPropertyValue("--accordion-panel-height")).toBe("80px");

  await user.click(trigger(getByText, "One"));
  await frame();
  await frame();
  const opening = panel.getBoundingClientRect().height;
  expect(opening).toBeGreaterThan(0);
  expect(opening).toBeLessThan(80);
  await expect.poll(() => panel.style.getPropertyValue("--accordion-panel-height")).toBe("auto");
});

test("an item open from the start can animate out before its size has settled", async () => {
  const { getByTestId, getByText } = mount(basic);
  const panel = getByTestId("panel-one");
  // Pressed straight after mounting, before the open size has become `auto`.
  expect(panel.style.getPropertyValue("--accordion-panel-height")).toBe("");
  trigger(getByText, "One").click();
  flush();
  expect(panel.style.getPropertyValue("--accordion-panel-height")).toBe("80px");
  await frame();
  await frame();
  expect(panel.getBoundingClientRect().height).toBeLessThan(80);
  await expect.poll(() => details(getByTestId("item-one")).open).toBe(false);
});

test("trigger props work on a summary the consumer writes, with a heading inside", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  const four = details(getByTestId("item-four"));
  await user.click(getByRole("heading", { name: "Four" }));
  expect(four.open).toBe(true);
  expect(getByTestId("panel-four").checkVisibility()).toBe(true);
});

test("a disabled item can't be toggled and the arrow keys skip it", async () => {
  const { getByTestId, getByText, user } = mount(basic);
  const three = trigger(getByText, "Three");
  expect(three.getAttribute("aria-disabled")).toBe("true");
  expect(three.tabIndex).toBe(-1);
  expect(getByTestId("item-three").hasAttribute("data-disabled")).toBe(true);
  await user.click(three);
  await frame();
  expect(details(getByTestId("item-three")).open).toBe(false);
  expect(getByTestId("changes").textContent).toBe("");

  trigger(getByText, "Two").focus();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(getByTestId("own"));
});

test("arrow keys, Home and End move between triggers and wrap", async () => {
  const { getByTestId, getByText, user } = mount(basic);
  const one = trigger(getByText, "One");
  one.focus();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(trigger(getByText, "Two"));
  await user.keyboard("{ArrowUp}{ArrowUp}");
  expect(document.activeElement).toBe(getByTestId("own"));
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(one);
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(getByTestId("own"));
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(one);
  // Horizontal arrows do nothing in a vertical accordion.
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(one);
});

test("keys pressed inside a panel stay there", async () => {
  const { getByRole, user } = mount(basic);
  const note = getByRole("textbox", { name: "Note" }) as HTMLInputElement;
  await user.click(note);
  await user.keyboard("ab{ArrowDown}{Home}{End}");
  expect(document.activeElement).toBe(note);
  expect(note.value).toBe("ab");
});

test("Enter and Space toggle the focused item", async () => {
  const { getByTestId, getByText, user } = mount(basic);
  const two = details(getByTestId("item-two"));
  trigger(getByText, "Two").focus();
  await user.keyboard("{Enter}");
  expect(two.open).toBe(true);
  await user.keyboard(" ");
  await expect.poll(() => two.open).toBe(false);
});

test("an item the browser opens by itself is reported once, and closes the other", async () => {
  const { getByTestId } = mount(basic);
  // What find-in-page does: the browser sets `open` on the item that holds the match.
  details(getByTestId("item-two")).open = true;
  expect(details(getByTestId("item-one")).open).toBe(false);
  await expect.poll(() => getByTestId("changes").textContent).toBe("two");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(getByTestId("changes").textContent).toBe("two");
});

test("`multiple` keeps several items open, controlled by `value`", async () => {
  const { getByRole, getByTestId, getByText, user } = mount(multiple);
  const a = details(getByTestId("item-a"));
  const b = details(getByTestId("item-b"));
  expect(a.name).toBe("");
  await user.click(trigger(getByText, "Beta"));
  expect(getByTestId("value").textContent).toBe("a,b");
  expect(a.open).toBe(true);
  expect(b.open).toBe(true);

  await user.click(trigger(getByText, "Alpha"));
  expect(getByTestId("value").textContent).toBe("b");
  await expect.poll(() => a.open).toBe(false);

  await user.click(getByRole("button", { name: "Close all" }));
  await expect.poll(() => b.open).toBe(false);

  // An item without a `value` gets one of its own.
  await user.click(trigger(getByText, "Gamma"));
  expect(getByTestId("value").textContent).toMatch(/^rs-ui-accordion-item-\d+$/);
  expect(details(getByTestId("item-c")).open).toBe(true);
});

test("a controlled value that doesn't change keeps the items as they are", async () => {
  const { getByTestId, getByText, user } = mount(multiple);
  const x = details(getByTestId("item-x"));
  const y = details(getByTestId("item-y"));
  await user.click(trigger(getByText, "Why"));
  await frame();
  expect(y.open).toBe(false);
  expect(x.open).toBe(true);
  await user.click(trigger(getByText, "Ex"));
  await frame();
  expect(x.open).toBe(true);
  expect(getByTestId("requests").textContent).toBe("2");
});

test("a horizontal accordion uses Left and Right, without wrapping when `loopFocus` is false", async () => {
  const { getByTestId, getByText, user } = mount(multiple);
  expect(getByTestId("controlled").getAttribute("data-orientation")).toBe("horizontal");
  const alpha = trigger(getByText, "Alpha");
  alpha.focus();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(alpha);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(alpha);
  await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
  expect(document.activeElement).toBe(trigger(getByText, "Gamma"));
});

test("a disabled root disables every item", async () => {
  const { getByTestId, getByText, user } = mount(multiple);
  const locked = trigger(getByText, "Locked");
  expect(locked.getAttribute("aria-disabled")).toBe("true");
  expect(getByTestId("disabled").hasAttribute("data-disabled")).toBe(true);
  await user.click(locked);
  await frame();
  expect(details(getByTestId("item-z")).open).toBe(false);
});
