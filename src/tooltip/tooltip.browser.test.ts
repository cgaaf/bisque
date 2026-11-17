import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";
import nested from "./fixtures/nested.rx";
import provider from "./fixtures/provider.rx";

const shown = (popup: HTMLElement) => popup.matches(":popover-open");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Mounted = ReturnType<typeof mount>;

/** The real pointer stays where the last test left it: start each test away from every trigger. */
async function start(fixture: Parameters<typeof mount>[0]): Promise<Mounted> {
  const mounted = mount(fixture);
  await mounted.user.hover(mounted.getByTestId("outside"));
  return mounted;
}

/**
 * Keyboard-style focus on `element`. Tabbing to it isn't portable (Safari skips buttons), so focus is first moved
 * with Tab, to wherever it goes, after which focus moved by script matches `:focus-visible` in every engine.
 * A key press alone isn't enough: Firefox goes by how focus last moved, and a click earlier in the run counts.
 */
async function keyboardFocus(user: Mounted["user"], element: HTMLElement) {
  await user.keyboard("{Tab}");
  element.focus();
}

/** Moves the real pointer to a point of the viewport, over `within` (which must be what is hit there). */
async function pointAt(user: Mounted["user"], within: HTMLElement, x: number, y: number) {
  const box = within.getBoundingClientRect();
  await user.hover(within, { position: { x: x - box.left, y: y - box.top } });
}

test("opens on hover after the default 600ms, as a tooltip described by the trigger", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const trigger = getByRole("button", { name: "Bold" });
  const popup = getByTestId("popup");
  expect(shown(popup)).toBe(false);
  expect(popup.getAttribute("popover")).toBe("manual");
  expect(popup.getAttribute("role")).toBe("tooltip");
  expect(trigger.hasAttribute("aria-describedby")).toBe(false);
  expect(trigger.hasAttribute("popovertarget")).toBe(false);

  await user.hover(trigger);
  await sleep(400);
  expect(shown(popup)).toBe(false);
  await expect.poll(() => shown(popup), { timeout: 1000 }).toBe(true);
  expect(trigger.getAttribute("aria-describedby")).toBe(popup.id);
  expect(trigger.hasAttribute("data-popup-open")).toBe(true);
  // A tooltip never takes focus.
  expect(document.activeElement).toBe(document.body);
  expect(getByTestId("changes").textContent).toBe("1");
});

test("the browser places it above the trigger, centred, sideOffset away", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const trigger = getByRole("button", { name: "Bold" });
  const popup = getByTestId("popup");
  await user.hover(trigger);
  await expect.poll(() => shown(popup), { timeout: 1500 }).toBe(true);
  await frame();
  const anchor = trigger.getBoundingClientRect();
  const placed = popup.getBoundingClientRect();
  expect(Math.round(anchor.top - placed.bottom)).toBe(10);
  expect(Math.abs(Math.round(placed.left + placed.width / 2 - (anchor.left + anchor.width / 2)))).toBe(0);
});

test("closes as soon as the pointer leaves for somewhere else", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const trigger = getByRole("button", { name: "Bold" });
  const popup = getByTestId("popup");
  await user.hover(trigger);
  await expect.poll(() => shown(popup), { timeout: 1500 }).toBe(true);
  await user.hover(getByTestId("outside"));
  await expect.poll(() => shown(popup)).toBe(false);
  expect(trigger.hasAttribute("aria-describedby")).toBe(false);
  expect(getByTestId("changes").textContent).toBe("2");
});

test("opens at once on keyboard focus and closes on blur", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const trigger = getByRole("button", { name: "Bold" });
  const popup = getByTestId("popup");
  await keyboardFocus(user, trigger);
  await expect.poll(() => shown(popup), { timeout: 200 }).toBe(true);
  getByRole("button", { name: "Before" }).focus();
  await expect.poll(() => shown(popup)).toBe(false);
});

test("a press before the delay cancels the pending open, and the focus it gives doesn't open it", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const trigger = getByRole("button", { name: "Bold" });
  await user.click(trigger);
  await sleep(900);
  expect(shown(getByTestId("popup"))).toBe(false);
});

test("pressing the trigger closes it, and hover doesn't reopen it until the pointer leaves", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const trigger = getByRole("button", { name: "Bold" });
  const popup = getByTestId("popup");
  await user.hover(trigger);
  await expect.poll(() => shown(popup), { timeout: 1500 }).toBe(true);
  await user.click(trigger);
  await expect.poll(() => shown(popup)).toBe(false);
  await sleep(900);
  expect(shown(popup)).toBe(false);

  await user.hover(getByTestId("outside"));
  await user.hover(trigger);
  await expect.poll(() => shown(popup), { timeout: 1500 }).toBe(true);
});

test("closeOnClick={false}: a press leaves it open", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const trigger = getByRole("button", { name: "Underline" });
  const popup = getByTestId("underline-popup");
  await user.hover(trigger);
  await expect.poll(() => shown(popup), { timeout: 200 }).toBe(true);
  await user.click(trigger);
  await sleep(100);
  expect(shown(popup)).toBe(true);
});

test("Escape closes it", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const trigger = getByRole("button", { name: "Underline" });
  const popup = getByTestId("underline-popup");
  await user.hover(trigger);
  await expect.poll(() => shown(popup), { timeout: 200 }).toBe(true);
  await user.keyboard("{Escape}");
  await expect.poll(() => shown(popup)).toBe(false);
});

test("the pointer can move onto the popup, and leaving the popup closes it", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const trigger = getByRole("button", { name: "Bold" });
  const popup = getByTestId("popup");
  await user.hover(trigger);
  await expect.poll(() => shown(popup), { timeout: 1500 }).toBe(true);
  await user.hover(popup);
  await sleep(200);
  expect(shown(popup)).toBe(true);
  await user.hover(getByTestId("outside"));
  await expect.poll(() => shown(popup)).toBe(false);
});

test("disableHoverablePopup: moving onto the popup closes it", async () => {
  const { getByRole, getByTestId, container, user } = await start(basic);
  const popup = getByTestId("italic-popup");
  await user.hover(getByRole("button", { name: "Italic" }));
  await expect.poll(() => shown(popup), { timeout: 200 }).toBe(true);
  await frame();
  const box = popup.getBoundingClientRect();
  // Straight onto the popup (it closes on the way, so it can't be the hover target).
  await pointAt(user, container.querySelector("main")!, box.left + box.width / 2, box.top + box.height / 2);
  await expect.poll(() => shown(popup)).toBe(false);
});

test("the safe area keeps it open while the pointer crosses the gap, and closes once it strays", async () => {
  const { getByRole, getByTestId, container, user } = await start(basic);
  const trigger = getByRole("button", { name: "Bold" });
  const popup = getByTestId("popup");
  const page = container.querySelector("main")!;
  await user.hover(trigger);
  await expect.poll(() => shown(popup), { timeout: 1500 }).toBe(true);
  await frame();
  const anchor = trigger.getBoundingClientRect();
  const placed = popup.getBoundingClientRect();
  const centre = anchor.left + anchor.width / 2;
  // The popup is 10px above the trigger and 40px wider on each side.
  expect(Math.round(anchor.top - placed.bottom)).toBe(10);

  // Into the gap, straight up from the trigger.
  await pointAt(user, page, centre, anchor.top - 5);
  await sleep(100);
  expect(shown(popup)).toBe(true);
  // Sideways into the triangle towards the popup's bottom corners: outside the trigger's width.
  await pointAt(user, page, anchor.left - 6, anchor.top - 8);
  await sleep(100);
  expect(shown(popup)).toBe(true);
  // Off to the side, outside the triangle.
  await pointAt(user, page, placed.left - 60, anchor.top - 8);
  await expect.poll(() => shown(popup)).toBe(false);
});

test("leaving away from the popup closes it even with the safe area", async () => {
  const { getByRole, getByTestId, container, user } = await start(basic);
  const trigger = getByRole("button", { name: "Bold" });
  const popup = getByTestId("popup");
  await user.hover(trigger);
  await expect.poll(() => shown(popup), { timeout: 1500 }).toBe(true);
  const anchor = trigger.getBoundingClientRect();
  await pointAt(user, container.querySelector("main")!, anchor.left + anchor.width / 2, anchor.bottom + 6);
  await expect.poll(() => shown(popup)).toBe(false);
});

test("a disabled tooltip never opens", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const trigger = getByRole("button", { name: "Strike" });
  await user.hover(trigger);
  await keyboardFocus(user, trigger);
  await sleep(200);
  expect(shown(getByTestId("strike-popup"))).toBe(false);
  expect(trigger.hasAttribute("aria-describedby")).toBe(false);
});

test("controlled: shown from the start against its trigger, below and start-aligned", async () => {
  const { getByRole, getByTestId } = await start(controlled);
  const trigger = getByRole("button", { name: "Save" });
  const popup = getByTestId("popup");
  expect(shown(popup)).toBe(true);
  expect(trigger.getAttribute("aria-describedby")).toBe(popup.id);
  await frame();
  const anchor = trigger.getBoundingClientRect();
  const placed = popup.getBoundingClientRect();
  expect(Math.round(placed.top - anchor.bottom)).toBe(4);
  expect(Math.abs(Math.round(placed.left - anchor.left))).toBe(0);
});

test("controlled: a press asks the owner to close it; the owner can open it; Escape asks again", async () => {
  const { getByRole, getByTestId, user } = await start(controlled);
  const trigger = getByRole("button", { name: "Save" });
  const popup = getByTestId("popup");
  await user.click(trigger);
  await expect.poll(() => getByTestId("open").textContent).toBe("closed");
  expect(shown(popup)).toBe(false);
  await user.click(getByRole("button", { name: "Toggle from outside" }));
  await expect.poll(() => shown(popup)).toBe(true);
  await user.keyboard("{Escape}");
  await expect.poll(() => getByTestId("open").textContent).toBe("closed");
  expect(shown(popup)).toBe(false);
});

test("a press outside closes it", async () => {
  const { getByTestId, user } = await start(controlled);
  const popup = getByTestId("popup");
  expect(shown(popup)).toBe(true);
  // The pointer was never on the trigger, so only the press can close it.
  await user.click(getByTestId("outside"));
  await expect.poll(() => getByTestId("open").textContent).toBe("closed");
  expect(shown(popup)).toBe(false);
});

test("inside a popover, Escape closes the tooltip and leaves the popover open", async () => {
  const mounted = mount(nested);
  const { getByRole, getByTestId, user } = mounted;
  const panel = getByTestId("panel");
  const popup = getByTestId("popup");
  // Opened from the keyboard: in Firefox, focus moved by script after a click isn't keyboard focus.
  getByRole("button", { name: "Format" }).focus();
  await user.keyboard("{Enter}");
  expect(shown(panel)).toBe(true);
  await keyboardFocus(user, getByRole("button", { name: "Bold" }));
  await expect.poll(() => shown(popup), { timeout: 200 }).toBe(true);
  await user.keyboard("{Escape}");
  await expect.poll(() => shown(popup)).toBe(false);
  expect(shown(panel)).toBe(true);
  await user.keyboard("{Escape}");
  await expect.poll(() => shown(panel)).toBe(false);
});

test("provider: its delays apply, and a trigger's own delay wins", async () => {
  const { getByRole, getByTestId, user } = await start(provider);
  const undo = getByTestId("undo-popup");
  await user.hover(getByRole("button", { name: "Undo" }));
  await sleep(150);
  expect(shown(undo)).toBe(false);
  await expect.poll(() => shown(undo), { timeout: 500 }).toBe(true);
  await user.hover(getByTestId("outside"));
  // closeDelay 300.
  expect(shown(undo)).toBe(true);
  await expect.poll(() => shown(undo), { timeout: 700 }).toBe(false);
  await sleep(500);

  const share = getByTestId("share-popup");
  await user.hover(getByRole("button", { name: "Share" }));
  await sleep(600);
  expect(shown(share)).toBe(false);
  await expect.poll(() => shown(share), { timeout: 1000 }).toBe(true);
});

test("provider: once one is open, the next opens at once and the first closes", async () => {
  const { getByRole, getByTestId, user } = await start(provider);
  const undo = getByTestId("undo-popup");
  const redo = getByTestId("redo-popup");
  await user.hover(getByRole("button", { name: "Undo" }));
  await expect.poll(() => shown(undo), { timeout: 600 }).toBe(true);
  await user.hover(getByRole("button", { name: "Redo" }));
  await expect.poll(() => shown(redo), { timeout: 100 }).toBe(true);
  expect(shown(undo)).toBe(false);
});

test("provider: within the timeout the next opens at once; after it, it waits again", async () => {
  const { getByRole, getByTestId, user } = await start(provider);
  const undo = getByTestId("undo-popup");
  const redo = getByTestId("redo-popup");
  const outside = getByTestId("outside");
  await user.hover(getByRole("button", { name: "Undo" }));
  await expect.poll(() => shown(undo), { timeout: 600 }).toBe(true);
  await user.hover(outside);
  await expect.poll(() => shown(undo), { timeout: 700 }).toBe(false);

  await sleep(100);
  await user.hover(getByRole("button", { name: "Redo" }));
  await expect.poll(() => shown(redo), { timeout: 100 }).toBe(true);

  await user.hover(outside);
  await expect.poll(() => shown(redo), { timeout: 700 }).toBe(false);
  await sleep(550);
  await user.hover(getByRole("button", { name: "Undo" }));
  await sleep(150);
  expect(shown(undo)).toBe(false);
  await expect.poll(() => shown(undo), { timeout: 600 }).toBe(true);
});

test("the popup carries the side it is on, and its arrow sits on the edge facing the trigger", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const trigger = getByRole("button", { name: "Bold" });
  const popup = getByTestId("popup");
  const arrow = getByTestId("arrow");
  expect(popup.getAttribute("data-side")).toBe("top");
  await keyboardFocus(user, trigger);
  await expect.poll(() => arrow.getAttribute("data-side")).toBe("top");
  const box = arrow.getBoundingClientRect();
  const anchor = trigger.getBoundingClientRect();
  expect(Math.abs(box.left + box.width / 2 - (anchor.left + anchor.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs(box.top + box.height / 2 - popup.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1);
});
