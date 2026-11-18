// Sortable in Chromium, Firefox and WebKit: real mouse drags (press, several moves, release) and the whole keyboard
// path, in both orientations and across two lists of a group.
import { afterEach, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import group from "./fixtures/group.rx";
import horizontal from "./fixtures/horizontal.rx";
import scroll from "./fixtures/scroll.rx";

afterEach(async () => {
  // A failed drag must not leave the button down for the next test.
  await userEvent.pointer({ keys: "[/MouseLeft]" }).catch(() => undefined);
});

type Point = { x: number; y: number };

function centerOf(element: Element): Point {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function path(from: Point, to: Point, steps: number) {
  return Array.from({ length: steps }, (_, i) => ({
    coords: {
      x: from.x + ((to.x - from.x) * (i + 1)) / steps,
      y: from.y + ((to.y - from.y) * (i + 1)) / steps,
    },
  }));
}

/** Presses the mouse on `element` and moves it by `by` in several steps, leaving the button down. */
async function press(element: Element, by: Point, steps = 8, at?: Point): Promise<Point> {
  const box = element.getBoundingClientRect();
  const from = at ? { x: box.left + at.x, y: box.top + at.y } : centerOf(element);
  const to = { x: from.x + by.x, y: from.y + by.y };
  await userEvent.pointer([{ coords: from }, { keys: "[MouseLeft>]" }, ...path(from, to, steps)]);
  await frame();
  return to;
}

async function moveTo(from: Point, to: Point, steps = 6): Promise<Point> {
  await userEvent.pointer(path(from, to, steps));
  await frame();
  return to;
}

async function release() {
  await userEvent.pointer({ keys: "[/MouseLeft]" });
  await frame();
}

/** Presses, moves and releases. */
async function drag(element: Element, by: Point, steps = 8) {
  await press(element, by, steps);
  await release();
}

function offset(element: HTMLElement) {
  return {
    x: Number.parseFloat(element.style.getPropertyValue("--sortable-x")),
    y: Number.parseFloat(element.style.getPropertyValue("--sortable-y")),
  };
}

function announcer(): HTMLElement {
  return document.querySelector<HTMLElement>("[data-bisque-sortable-announcer]")!;
}

function text(getByTestId: (id: string) => HTMLElement, id: string) {
  return getByTestId(id).textContent;
}

// Each item is 30px high with a 4px gap: a step is 34px.
const STEP = 34;

test("at rest: handles are described by the instructions, the live region is empty and nothing is offset", () => {
  const { getByTestId, getByRole } = mount(basic);
  const handle = getByRole("button", { name: "Move apple" });
  expect(handle.getAttribute("aria-roledescription")).toBe("sortable");
  expect(handle.getAttribute("type")).toBe("button");
  expect(handle.style.touchAction).toBe("none");
  const description = document.getElementById(handle.getAttribute("aria-describedby")!)!;
  expect(description.textContent).toContain("Press Space or Enter to pick up");
  expect(description.hidden).toBe(true);
  expect(announcer().getAttribute("aria-live")).toBe("assertive");
  expect(announcer().textContent).toBe("");
  expect(handle.hasAttribute("aria-pressed")).toBe(false);
  const list = getByTestId("list");
  expect(list.tagName).toBe("UL");
  expect(list.getAttribute("data-orientation")).toBe("vertical");
  expect(list.hasAttribute("data-dragging")).toBe(false);
  expect(getByTestId("apple").tagName).toBe("LI");
  expect(offset(getByTestId("apple"))).toEqual({ x: 0, y: 0 });
  // An item with a handle isn't a handle itself.
  expect(getByTestId("apple").hasAttribute("tabindex")).toBe(false);
  // A disabled item's handle is disabled.
  expect(getByRole("button", { name: "Move cherry" }).hasAttribute("disabled")).toBe(true);
  expect(getByTestId("cherry").hasAttribute("data-disabled")).toBe(true);
});

test("keyboard: Space picks up, the arrows move, Enter drops; the order changes once and focus stays", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  const handle = getByRole("button", { name: "Move apple" });
  handle.focus();
  await user.keyboard(" ");
  expect(announcer().textContent).toBe("Picked up apple, position 1 of 5.");
  // Which input is dragging, so the CSS can animate a keyboard step but not a pointer that is followed.
  expect(getByTestId("list").getAttribute("data-dragging")).toBe("keyboard");
  expect(getByTestId("apple").getAttribute("data-dragging")).toBe("keyboard");
  expect(getByTestId("banana").hasAttribute("data-dragging")).toBe(false);
  expect(handle.getAttribute("aria-pressed")).toBe("true");
  expect(text(getByTestId, "log")).toBe("start apple :0>:0 keyboard");

  await user.keyboard("{ArrowDown}");
  await user.keyboard("{ArrowDown}");
  expect(announcer().textContent).toBe("apple moved to position 3 of 5.");
  // Nothing moved in the DOM: the dragged item is offset to its new slot, and the two it passed make way.
  expect(text(getByTestId, "order")).toBe("apple,banana,cherry,date,elder");
  expect(offset(getByTestId("apple"))).toEqual({ x: 0, y: 2 * STEP });
  expect(offset(getByTestId("banana"))).toEqual({ x: 0, y: -STEP });
  expect(offset(getByTestId("cherry"))).toEqual({ x: 0, y: -STEP });
  expect(getByTestId("banana").hasAttribute("data-shifted")).toBe(true);
  expect(getByTestId("date").hasAttribute("data-shifted")).toBe(false);
  expect(getByTestId("date").getAttribute("data-drop-target")).toBe("before");
  expect(document.activeElement).toBe(handle);

  await user.keyboard("{Enter}");
  expect(text(getByTestId, "order")).toBe("banana,cherry,apple,date,elder");
  expect(text(getByTestId, "changes")).toBe("1");
  expect(announcer().textContent).toBe("Dropped apple at position 3 of 5.");
  expect(getByTestId("list").hasAttribute("data-dragging")).toBe(false);
  expect(offset(getByTestId("apple"))).toEqual({ x: 0, y: 0 });
  expect(offset(getByTestId("banana"))).toEqual({ x: 0, y: 0 });
  expect(getByTestId("date").hasAttribute("data-drop-target")).toBe(false);
  const items = [...getByTestId("list").querySelectorAll("li")].map((li) => li.dataset.testid);
  expect(items).toEqual(["banana", "cherry", "apple", "date", "elder"]);
  // The moved row lost focus when the list reordered it; it is given back.
  await expect.poll(() => document.activeElement).toBe(getByRole("button", { name: "Move apple" }));
  expect(text(getByTestId, "log")).toBe(
    "start apple :0>:0 keyboard|over apple :0>:1 keyboard|over apple :0>:2 keyboard|end apple :0>:2 keyboard",
  );
});

test("keyboard: Escape cancels, puts the item back and changes nothing", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  const handle = getByRole("button", { name: "Move date" });
  handle.focus();
  await user.keyboard("{Enter}");
  await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
  expect(offset(getByTestId("date"))).toEqual({ x: 0, y: -3 * STEP });
  await user.keyboard("{Escape}");
  expect(announcer().textContent).toBe("Cancelled. date is back at position 4 of 5.");
  expect(text(getByTestId, "order")).toBe("apple,banana,cherry,date,elder");
  expect(text(getByTestId, "changes")).toBe("0");
  expect(offset(getByTestId("date"))).toEqual({ x: 0, y: 0 });
  expect(getByTestId("list").hasAttribute("data-dragging")).toBe(false);
  expect(text(getByTestId, "log").split("|").at(-1)).toBe("cancel date :3>:3 keyboard");
  expect(document.activeElement).toBe(handle);
});

test("keyboard: Home and End go to the ends, and the arrows stop there", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  getByRole("button", { name: "Move banana" }).focus();
  await user.keyboard(" ");
  await user.keyboard("{End}");
  expect(announcer().textContent).toBe("banana moved to position 5 of 5.");
  expect(getByTestId("elder").getAttribute("data-drop-target")).toBe("after");
  await user.keyboard("{ArrowDown}");
  expect(announcer().textContent!.trim()).toBe("banana moved to position 5 of 5.");
  await user.keyboard("{Home}");
  expect(announcer().textContent).toBe("banana moved to position 1 of 5.");
  await user.keyboard("{ArrowUp}");
  await user.keyboard(" ");
  expect(text(getByTestId, "order")).toBe("banana,apple,cherry,date,elder");
});

test("keyboard: a repeated message is still a change of text for the live region", async () => {
  const { getByRole, user } = mount(basic);
  getByRole("button", { name: "Move banana" }).focus();
  await user.keyboard(" ");
  await user.keyboard("{End}");
  const first = announcer().textContent;
  await user.keyboard("{ArrowDown}");
  expect(announcer().textContent).not.toBe(first);
  expect(announcer().textContent!.trim()).toBe(first!.trim());
  await user.keyboard("{Escape}");
});

test("keyboard: focus leaving the handle mid-drag cancels it", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  getByRole("button", { name: "Move apple" }).focus();
  await user.keyboard(" ");
  await user.keyboard("{ArrowDown}");
  getByRole("button", { name: "Move elder" }).focus();
  await expect.poll(() => getByTestId("list").hasAttribute("data-dragging")).toBe(false);
  expect(text(getByTestId, "order")).toBe("apple,banana,cherry,date,elder");
  expect(text(getByTestId, "log").split("|").at(-1)).toBe("cancel apple :0>:0 keyboard");
});

test("a disabled item can't be picked up, but makes way for others", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  getByRole("button", { name: "Move banana" }).focus();
  await user.keyboard(" ");
  await user.keyboard("{ArrowDown}");
  expect(getByTestId("cherry").hasAttribute("data-shifted")).toBe(true);
  await user.keyboard(" ");
  expect(text(getByTestId, "order")).toBe("apple,cherry,banana,date,elder");
  // The disabled handle takes no focus, and a drag on it does nothing.
  await drag(getByRole("button", { name: "Move cherry" }), { x: 0, y: STEP * 2 });
  expect(text(getByTestId, "order")).toBe("apple,cherry,banana,date,elder");
});

test("pointer: a drag follows the pointer, opens a gap, and drops where it is released", async () => {
  const { getByTestId, getByRole } = mount(basic);
  const handle = getByRole("button", { name: "Move apple" });
  const at = await press(handle, { x: 0, y: STEP * 2 + 4 });
  const apple = getByTestId("apple");
  expect(apple.getAttribute("data-dragging")).toBe("pointer");
  expect(getByTestId("list").getAttribute("data-dragging")).toBe("pointer");
  expect(getByTestId("list").hasAttribute("data-drop-target")).toBe(true);
  // The item is where the pointer took it, and the two it passed make way.
  expect(Math.abs(offset(apple).y - (STEP * 2 + 4))).toBeLessThan(1);
  expect(offset(getByTestId("banana")).y).toBe(-STEP);
  expect(offset(getByTestId("cherry")).y).toBe(-STEP);
  expect(offset(getByTestId("date")).y).toBe(0);
  expect(text(getByTestId, "order")).toBe("apple,banana,cherry,date,elder");
  expect(announcer().textContent).toBe("apple moved to position 3 of 5.");
  // Back up a little: one fewer makes way.
  await moveTo(at, { x: at.x, y: at.y - STEP });
  expect(offset(getByTestId("cherry")).y).toBe(0);
  expect(offset(getByTestId("banana")).y).toBe(-STEP);
  await release();
  expect(text(getByTestId, "order")).toBe("banana,apple,cherry,date,elder");
  expect(offset(apple).y).toBe(0);
  expect(apple.hasAttribute("data-dragging")).toBe(false);
  expect(getByTestId("list").hasAttribute("data-drop-target")).toBe(false);
  expect(announcer().textContent).toBe("Dropped apple at position 2 of 5.");
  expect(text(getByTestId, "log").split("|")[0]).toBe("start apple :0>:0 pointer");
  expect(text(getByTestId, "log").split("|").at(-1)).toBe("end apple :0>:1 pointer");
});

test("pointer: dragging up past the first item puts it first", async () => {
  const { getByTestId, getByRole } = mount(basic);
  await drag(getByRole("button", { name: "Move elder" }), { x: 0, y: -STEP * 5 });
  expect(text(getByTestId, "order")).toBe("elder,apple,banana,cherry,date");
});

test("pointer: a press without a move is a click, not a drag", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  await user.click(getByRole("button", { name: "Move apple" }));
  expect(text(getByTestId, "log")).toBe("");
  expect(getByTestId("list").hasAttribute("data-dragging")).toBe(false);
});

test("pointer: Escape during a drag cancels it", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  await press(getByRole("button", { name: "Move apple" }), { x: 0, y: STEP * 3 });
  expect(getByTestId("apple").hasAttribute("data-dragging")).toBe(true);
  await user.keyboard("{Escape}");
  expect(getByTestId("apple").hasAttribute("data-dragging")).toBe(false);
  expect(offset(getByTestId("banana")).y).toBe(0);
  await release();
  expect(text(getByTestId, "order")).toBe("apple,banana,cherry,date,elder");
  expect(text(getByTestId, "log").split("|").at(-1)).toBe("cancel apple :0>:0 pointer");
});

// Horizontal: each chip is 60px wide with a 6px gap, and is its own handle.
const WIDE = 66;

test("horizontal, uncontrolled: an item with no handle is its own, focusable and described", () => {
  const { getByTestId } = mount(horizontal);
  const red = getByTestId("red");
  expect(getByTestId("tags").getAttribute("data-orientation")).toBe("horizontal");
  expect(red.getAttribute("tabindex")).toBe("0");
  expect(red.getAttribute("aria-roledescription")).toBe("sortable");
  expect(document.getElementById(red.getAttribute("aria-describedby")!)!.textContent).toContain("arrow keys");
  // A list rendered from its own order, in the order given.
  expect([...getByTestId("tags").querySelectorAll("li")].map((li) => li.dataset.testid)).toEqual([
    "red",
    "green",
    "blue",
    "gold",
  ]);
});

test("horizontal: the left and right arrows move an item, which renders in its new place from the list's own order", async () => {
  const { getByTestId, user } = mount(horizontal);
  getByTestId("red").focus();
  await user.keyboard("{Enter}");
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(offset(getByTestId("red"))).toEqual({ x: 2 * WIDE, y: 0 });
  expect(offset(getByTestId("green"))).toEqual({ x: -WIDE, y: 0 });
  // The vertical arrows do nothing in a list of its own.
  await user.keyboard("{ArrowDown}");
  expect(offset(getByTestId("red"))).toEqual({ x: 2 * WIDE, y: 0 });
  await user.keyboard("{ArrowLeft}");
  await user.keyboard(" ");
  expect(text(getByTestId, "order")).toBe("green,red,blue,gold keyboard");
  expect([...getByTestId("tags").querySelectorAll("li")].map((li) => li.dataset.testid)).toEqual([
    "green",
    "red",
    "blue",
    "gold",
  ]);
  await expect.poll(() => document.activeElement).toBe(getByTestId("red"));
});

test("horizontal: a key pressed in a control inside the item is the control's", async () => {
  const { getByTestId, user } = mount(horizontal);
  getByTestId("remove-red").focus();
  await user.keyboard(" ");
  expect(getByTestId("tags").hasAttribute("data-dragging")).toBe(false);
});

test("horizontal: a mouse drag moves an item along the row", async () => {
  const { getByTestId } = mount(horizontal);
  // Pressed on its text, left of its button.
  const at = await press(getByTestId("gold"), { x: -WIDE * 2 - 10, y: 0 }, 8, { x: 8, y: 15 });
  expect(getByTestId("gold").hasAttribute("data-dragging")).toBe(true);
  expect(offset(getByTestId("blue"))).toEqual({ x: WIDE, y: 0 });
  expect(offset(getByTestId("green"))).toEqual({ x: WIDE, y: 0 });
  expect(getByTestId("green").getAttribute("data-drop-target")).toBe("before");
  await moveTo(at, { x: at.x - 4, y: at.y + 2 });
  await release();
  expect(text(getByTestId, "order")).toBe("red,gold,green,blue pointer");
});

test("horizontal: a press on a control inside the item doesn't start a drag", async () => {
  const { getByTestId } = mount(horizontal);
  await drag(getByTestId("remove-red"), { x: WIDE * 2, y: 0 });
  expect(text(getByTestId, "order")).toBe("");
});

test("a disabled list can't be dragged from the keyboard or the pointer", async () => {
  const { getByTestId, user } = mount(horizontal);
  expect(getByTestId("locked").hasAttribute("data-disabled")).toBe(true);
  expect(getByTestId("one").getAttribute("aria-disabled")).toBe("true");
  getByTestId("one").focus();
  await user.keyboard(" ");
  expect(getByTestId("locked").hasAttribute("data-dragging")).toBe(false);
  await drag(getByTestId("one"), { x: WIDE * 2, y: 0 });
  expect(text(getByTestId, "locked-order")).toBe("");
});

// Group: three vertical lists side by side, 100px wide (plus 4px padding) and 20px apart.
const ACROSS = 128;

test("group: the cross-axis arrows move an item to the next list, and it lands there on drop", async () => {
  const { getByTestId, getByRole, user } = mount(group);
  getByRole("button", { name: "Move test" }).focus();
  await user.keyboard(" ");
  expect(announcer().textContent).toBe("Picked up test, position 2 of 3 in To do.");
  await user.keyboard("{ArrowRight}");
  expect(announcer().textContent).toBe("test moved to position 2 of 2 in Done.");
  expect(getByTestId("done").hasAttribute("data-drop-target")).toBe(true);
  expect(getByTestId("todo").hasAttribute("data-dragging")).toBe(true);
  expect(getByTestId("todo").hasAttribute("data-drop-target")).toBe(false);
  // It sits after "plan" in the other list, and "ship" closes the gap it left.
  expect(offset(getByTestId("test")).x).toBe(ACROSS);
  expect(offset(getByTestId("ship")).y).toBe(-STEP);
  expect(getByTestId("plan").getAttribute("data-drop-target")).toBe("after");
  await user.keyboard("{ArrowUp}");
  expect(announcer().textContent).toBe("test moved to position 1 of 2 in Done.");
  expect(offset(getByTestId("plan")).y).toBe(STEP);
  // The next list is disabled, and there is none beyond it.
  await user.keyboard("{ArrowRight}");
  expect(announcer().textContent).toBe("test moved to position 1 of 2 in Done.");
  await user.keyboard("{Enter}");
  expect(text(getByTestId, "todo-order")).toBe("write,ship");
  expect(text(getByTestId, "done-order")).toBe("test,plan");
  expect(announcer().textContent).toBe("Dropped test at position 1 of 2 in Done.");
  // The item is a new element in the other list; its handle takes the focus.
  await expect.poll(() => document.activeElement).toBe(getByRole("button", { name: "Move test" }));
  expect(getByTestId("done").contains(document.activeElement)).toBe(true);
  expect(text(getByTestId, "log").split("|").at(-1)).toBe("end test todo:1>done:0 keyboard");
});

test("group: a mouse drag carries an item into the other list", async () => {
  const { getByTestId, getByRole } = mount(group);
  const at = await press(getByRole("button", { name: "Move write" }), { x: ACROSS, y: STEP + 6 });
  expect(getByTestId("done").hasAttribute("data-drop-target")).toBe(true);
  expect(offset(getByTestId("test")).y).toBe(-STEP);
  expect(getByTestId("plan").getAttribute("data-drop-target")).toBe("after");
  await moveTo(at, { x: at.x, y: at.y - STEP - 16 });
  expect(offset(getByTestId("plan")).y).toBe(STEP);
  await release();
  expect(text(getByTestId, "todo-order")).toBe("test,ship");
  expect(text(getByTestId, "done-order")).toBe("write,plan");
});

test("group: a list emptied by a drag can take an item back", async () => {
  const { getByTestId, getByRole } = mount(group);
  await drag(getByRole("button", { name: "Move plan" }), { x: -ACROSS, y: 10 });
  expect(text(getByTestId, "done-order")).toBe("");
  expect(text(getByTestId, "todo-order")).toBe("write,plan,test,ship");
  await drag(getByRole("button", { name: "Move ship" }), { x: ACROSS, y: -STEP * 3 });
  expect(text(getByTestId, "done-order")).toBe("ship");
});

test("four drops in a row, from the keyboard and then the mouse", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  for (let i = 0; i < 4; i += 1) {
    getByRole("button", { name: "Move apple" }).focus();
    // oxlint-disable-next-line no-await-in-loop -- each drop acts on the order the one before left
    await user.keyboard(" ");
    // oxlint-disable-next-line no-await-in-loop
    await user.keyboard("{ArrowDown}");
    // oxlint-disable-next-line no-await-in-loop
    await user.keyboard(" ");
  }
  expect(text(getByTestId, "order")).toBe("banana,cherry,date,elder,apple");
  expect(text(getByTestId, "changes")).toBe("4");
  for (let i = 0; i < 4; i += 1) {
    // oxlint-disable-next-line no-await-in-loop
    await drag(getByRole("button", { name: "Move apple" }), { x: 0, y: -STEP - 6 });
  }
  expect(text(getByTestId, "order")).toBe("apple,banana,cherry,date,elder");
  expect(text(getByTestId, "changes")).toBe("8");
});

test("pointer: the release that ends a drag isn't a click on the list; a plain click still is", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  await drag(getByRole("button", { name: "Move apple" }), { x: 0, y: STEP + 6 });
  expect(text(getByTestId, "order")).toBe("banana,apple,cherry,date,elder");
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(text(getByTestId, "clicks")).toBe("0");
  await user.click(getByRole("button", { name: "Move apple" }));
  expect(text(getByTestId, "clicks")).toBe("1");
});

test("pointer: holding a dragged item near the edge of a list that scrolls scrolls it", async () => {
  const { getByTestId, getByRole } = mount(scroll);
  const list = getByTestId("list");
  const handle = getByRole("button", { name: "Move i0" });
  const box = list.getBoundingClientRect();
  const from = centerOf(handle);
  await press(handle, { x: 0, y: box.bottom - 8 - from.y });
  await expect.poll(() => list.scrollTop, { timeout: 3000 }).toBeGreaterThan(STEP * 3);
  // The dragged item stays under the pointer while the list scrolls under it.
  const dragged = list.querySelector<HTMLElement>('[data-bisque-sortable-item="i0"]')!;
  const under = dragged.getBoundingClientRect();
  expect(Math.abs(under.top + under.height / 2 - (box.bottom - 8))).toBeLessThan(STEP);
  await release();
  const order = text(getByTestId, "order")!.split(",");
  expect(order.indexOf("i0")).toBeGreaterThan(5);
});

function touch(type: string, at: Point) {
  const target = document.elementFromPoint(at.x, at.y) ?? document.documentElement;
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 7,
      isPrimary: true,
      button: type === "pointermove" ? -1 : 0,
      buttons: type === "pointerup" ? 0 : 1,
      pointerType: "touch",
      clientX: at.x,
      clientY: at.y,
    }),
  );
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Touch input is dispatched: what is under test is the press-and-hold rule, which no real touch screen drives here.
test("touch: an item that is its own handle starts dragging after a long press", async () => {
  const { getByTestId } = mount(horizontal);
  const box = getByTestId("red").getBoundingClientRect();
  const from = { x: box.left + 8, y: box.top + 15 };
  touch("pointerdown", from);
  await pause(350);
  expect(getByTestId("red").hasAttribute("data-dragging")).toBe(true);
  for (let i = 1; i <= 6; i += 1) touch("pointermove", { x: from.x + (WIDE * 2 * i) / 6 + 4, y: from.y });
  await frame();
  touch("pointerup", { x: from.x + WIDE * 2 + 4, y: from.y });
  await frame();
  expect(text(getByTestId, "order")).toBe("green,blue,red,gold pointer");
});

test("touch: a touch that moves before the long press is a scroll, not a drag", async () => {
  const { getByTestId } = mount(horizontal);
  const box = getByTestId("red").getBoundingClientRect();
  const from = { x: box.left + 8, y: box.top + 15 };
  touch("pointerdown", from);
  touch("pointermove", { x: from.x + 20, y: from.y });
  await pause(350);
  expect(getByTestId("red").hasAttribute("data-dragging")).toBe(false);
  touch("pointermove", { x: from.x + WIDE * 2, y: from.y });
  touch("pointerup", { x: from.x + WIDE * 2, y: from.y });
  await frame();
  expect(text(getByTestId, "order")).toBe("");
});

test("right to left: the arrow keys and the pointer follow the inline direction", async () => {
  const { getByTestId, user } = mount(horizontal);
  getByTestId("alef").focus();
  // This list's texts are its own: the role description, and the pick-up message (the rest stay English).
  expect(getByTestId("alef").getAttribute("aria-roledescription")).toBe("reorderable");
  await user.keyboard(" ");
  const live = getByTestId("rtl").parentElement!.querySelectorAll("[data-bisque-sortable-announcer]");
  expect([...live].map((el) => el.textContent)).toContain("Holding alef, 1/3");
  await user.keyboard("{ArrowLeft}");
  expect(offset(getByTestId("alef")).x).toBe(-WIDE);
  expect(offset(getByTestId("bet")).x).toBe(WIDE);
  await user.keyboard(" ");
  expect(text(getByTestId, "rtl-order")).toBe("bet,alef,gimel");
  // Pressed on its text, right of its button.
  await press(getByTestId("gimel"), { x: WIDE * 2 + 10, y: 0 }, 8, { x: 52, y: 15 });
  await release();
  expect(text(getByTestId, "rtl-order")).toBe("gimel,bet,alef");
});

test("group: a disabled list takes no drop, from the keyboard or the pointer", async () => {
  const { getByTestId, getByRole, user } = mount(group);
  expect(getByRole("button", { name: "Move idea" }).hasAttribute("disabled")).toBe(true);
  getByRole("button", { name: "Move plan" }).focus();
  await user.keyboard(" ");
  await user.keyboard("{ArrowRight}");
  expect(getByTestId("later").hasAttribute("data-drop-target")).toBe(false);
  expect(getByTestId("done").hasAttribute("data-drop-target")).toBe(true);
  await user.keyboard("{Escape}");
  await drag(getByRole("button", { name: "Move write" }), { x: ACROSS * 2, y: 0 });
  expect(text(getByTestId, "later-order")).toBe("idea");
  // Released over the disabled list, it lands in the last list it was over.
  expect(text(getByTestId, "todo-order")).toBe("test,ship");
  expect(text(getByTestId, "done-order")).toBe("write,plan");
});

test("group: four moves between the lists in a row", async () => {
  const { getByTestId, getByRole, user } = mount(group);
  for (const [id, key] of [
    ["write", "{ArrowRight}"],
    ["write", "{ArrowLeft}"],
    ["plan", "{ArrowLeft}"],
    ["test", "{ArrowRight}"],
  ]) {
    getByRole("button", { name: `Move ${id}` }).focus();
    // oxlint-disable-next-line no-await-in-loop -- each move acts on the lists the one before left
    await user.keyboard(" ");
    // oxlint-disable-next-line no-await-in-loop
    await user.keyboard(key);
    // oxlint-disable-next-line no-await-in-loop
    await user.keyboard(" ");
  }
  expect(text(getByTestId, "todo-order")).toBe("plan,write,ship");
  expect(text(getByTestId, "done-order")).toBe("test");
  await drag(getByRole("button", { name: "Move ship" }), { x: ACROSS, y: -STEP * 2 + 10 });
  expect(text(getByTestId, "done-order")).toBe("test,ship");
});

test("keyboard: moving an item past the end of a list that scrolls brings its slot into view", async () => {
  const { getByTestId, getByRole, user } = mount(scroll);
  const list = getByTestId("list");
  getByRole("button", { name: "Move i0" }).focus();
  await user.keyboard(" ");
  await user.keyboard("{End}");
  await frame();
  expect(list.scrollTop).toBeGreaterThan(STEP * 5);
  await user.keyboard("{Escape}");
});

test("pointer: edge scrolling works again on the next drag", async () => {
  const { getByTestId, getByRole } = mount(scroll);
  const list = getByTestId("list");
  const box = list.getBoundingClientRect();
  for (const id of ["i0", "i1"]) {
    list.scrollTop = 0;
    const handle = getByRole("button", { name: `Move ${id}` });
    // oxlint-disable-next-line no-await-in-loop -- the second drag is the point
    await press(handle, { x: 0, y: box.bottom - 8 - centerOf(handle).y });
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => list.scrollTop, { timeout: 3000 }).toBeGreaterThan(STEP * 2);
    // oxlint-disable-next-line no-await-in-loop
    await release();
  }
});

test("pointer: a drag over an item's text selects none of it, and Escape then release is no click", async () => {
  const { getByTestId, user } = mount(horizontal);
  document.getSelection()?.removeAllRanges();
  await press(getByTestId("green"), { x: WIDE + 20, y: 4 }, 8, { x: 4, y: 15 });
  expect(document.getSelection()?.toString()).toBe("");
  await user.keyboard("{Escape}");
  await moveTo(centerOf(getByTestId("blue")), {
    x: centerOf(getByTestId("gold")).x,
    y: centerOf(getByTestId("gold")).y,
  });
  expect(document.getSelection()?.toString()).toBe("");
  await release();
  expect(text(getByTestId, "order")).toBe("");
});
