import { fireEvent } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { flush, mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";
import provider from "./fixtures/provider.rx";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Fake timers for the delays; animation frames stay real so a closed popup can unmount. */
function setup() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

function advance(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

const isOpen = (trigger: HTMLElement) => trigger.hasAttribute("data-popup-open");

test("opens on hover after the default delay and is wired with aria-describedby", async () => {
  const user = setup();
  const { getByRole, queryByRole, getByTestId } = mount(basic);
  const trigger = getByRole("button", { name: "Bold" });
  expect(queryByRole("tooltip")).toBeNull();
  expect(trigger.hasAttribute("aria-describedby")).toBe(false);

  await user.hover(trigger);
  advance(599);
  expect(queryByRole("tooltip")).toBeNull();
  advance(1);
  const popup = getByRole("tooltip");
  expect(popup).toBe(getByTestId("popup"));
  expect(trigger.getAttribute("aria-describedby")).toBe(popup.id);
  expect(trigger.hasAttribute("data-popup-open")).toBe(true);
  expect(popup.hasAttribute("data-open")).toBe(true);
  expect(getByTestId("positioner").style.position).toBe("absolute");
  // Focus stays where it was: a tooltip never takes it.
  expect(document.activeElement).toBe(document.body);
  expect(getByTestId("changes").textContent).toBe("1");
});

test("closes as soon as the pointer leaves for somewhere else", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  const trigger = getByRole("button", { name: "Bold" });
  await user.hover(trigger);
  advance(600);
  await user.hover(getByTestId("outside"));
  expect(isOpen(trigger)).toBe(false);
  expect(trigger.hasAttribute("aria-describedby")).toBe(false);
  expect(getByTestId("changes").textContent).toBe("2");
});

test("lands on the top side by default", async () => {
  const user = setup();
  const { getByRole } = mount(basic);
  await user.hover(getByRole("button", { name: "Bold" }));
  advance(600);
  vi.useRealTimers();
  const popup = getByRole("tooltip");
  await expect.poll(() => popup.getAttribute("data-side")).toBe("top");
  expect(popup.getAttribute("data-align")).toBe("center");
});

test("opens at once on keyboard focus and closes on blur", async () => {
  const user = setup();
  const { getByRole } = mount(basic);
  const trigger = getByRole("button", { name: "Bold" });
  await user.tab();
  await user.tab();
  expect(document.activeElement).toBe(trigger);
  expect(isOpen(trigger)).toBe(true);
  expect(getByRole("tooltip")).toBeTruthy();
  await user.tab();
  expect(isOpen(trigger)).toBe(false);
});

test("focus from a pointer press doesn't open it", async () => {
  const user = setup();
  const { getByRole } = mount(basic);
  const trigger = getByRole("button", { name: "Bold" });
  await user.click(trigger);
  advance(1000);
  expect(document.activeElement).toBe(trigger);
  expect(isOpen(trigger)).toBe(false);
});

test("closeOnClick={false}: a press neither closes it nor opens it through focus", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  const trigger = getByRole("button", { name: "Underline" });
  // A press with no hover first: the focus it gives is not keyboard focus.
  await user.pointer([{ target: trigger, keys: "[MouseLeft]" }]);
  expect(document.activeElement).toBe(trigger);
  expect(isOpen(trigger)).toBe(false);

  await user.hover(getByTestId("outside"));
  await user.hover(trigger);
  advance(0);
  expect(isOpen(trigger)).toBe(true);
  await user.click(trigger);
  expect(isOpen(trigger)).toBe(true);
});

test("Escape closes it", async () => {
  const user = setup();
  const { getByRole } = mount(basic);
  const trigger = getByRole("button", { name: "Bold" });
  await user.tab();
  await user.tab();
  expect(isOpen(trigger)).toBe(true);
  await user.keyboard("{Escape}");
  expect(isOpen(trigger)).toBe(false);
});

test("pressing the trigger closes it, and hover doesn't reopen it until the pointer leaves", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  const trigger = getByRole("button", { name: "Bold" });
  await user.hover(trigger);
  advance(600);
  expect(isOpen(trigger)).toBe(true);
  await user.click(trigger);
  expect(isOpen(trigger)).toBe(false);
  advance(1000);
  expect(isOpen(trigger)).toBe(false);

  await user.hover(getByTestId("outside"));
  await user.hover(trigger);
  advance(600);
  expect(isOpen(trigger)).toBe(true);
});

test("a press before the delay cancels the pending open", async () => {
  const user = setup();
  const { getByRole } = mount(basic);
  const trigger = getByRole("button", { name: "Bold" });
  await user.hover(trigger);
  advance(300);
  await user.click(trigger);
  advance(1000);
  expect(isOpen(trigger)).toBe(false);
});

test("the pointer can move onto the popup, and leaving the popup closes it", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  const trigger = getByRole("button", { name: "Bold" });
  await user.hover(trigger);
  advance(600);
  await user.hover(getByTestId("popup"));
  advance(1000);
  expect(isOpen(trigger)).toBe(true);
  await user.hover(getByTestId("outside"));
  expect(isOpen(trigger)).toBe(false);
});

test("disableHoverablePopup: moving onto the popup closes it", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  const trigger = getByRole("button", { name: "Italic" });
  await user.hover(trigger);
  advance(0);
  expect(isOpen(trigger)).toBe(true);
  await user.hover(getByTestId("italic-popup"));
  expect(isOpen(trigger)).toBe(false);
});

test("the safe area keeps it open while the pointer crosses the gap to the popup", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  const trigger = getByRole("button", { name: "Bold" });
  await user.hover(trigger);
  advance(600);
  const popup = getByTestId("popup");
  // The trigger at (100, 100) 40x20; the popup above it, 10px away, at (60, 30) 120x60.
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(rect(100, 100, 40, 20));
  vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(rect(60, 30, 120, 60));

  fireEvent.pointerLeave(trigger, { clientX: 120, clientY: 100, relatedTarget: document.body });
  // In the gap between them.
  fireEvent.pointerMove(document.body, { clientX: 118, clientY: 95 });
  // In the triangle from the exit point to the popup's bottom corners, wider than the trigger.
  fireEvent.pointerMove(document.body, { clientX: 80, clientY: 92 });
  flush();
  expect(isOpen(trigger)).toBe(true);
  // Off to the side, outside the triangle.
  fireEvent.pointerMove(document.body, { clientX: 20, clientY: 95 });
  flush();
  expect(isOpen(trigger)).toBe(false);
});

test("leaving away from the popup closes it even with the safe area", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  const trigger = getByRole("button", { name: "Bold" });
  await user.hover(trigger);
  advance(600);
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(rect(100, 100, 40, 20));
  vi.spyOn(getByTestId("popup"), "getBoundingClientRect").mockReturnValue(rect(60, 30, 120, 60));
  fireEvent.pointerLeave(trigger, { clientX: 120, clientY: 120, relatedTarget: document.body });
  fireEvent.pointerMove(document.body, { clientX: 120, clientY: 125 });
  flush();
  expect(isOpen(trigger)).toBe(false);
});

test("a disabled tooltip never opens", async () => {
  const user = setup();
  const { getByRole, queryByRole } = mount(basic);
  const trigger = getByRole("button", { name: "Strike" });
  await user.hover(trigger);
  advance(1000);
  trigger.focus();
  flush();
  expect(queryByRole("tooltip")).toBeNull();
});

test("can be controlled", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(controlled);
  const trigger = getByRole("button", { name: "Save" });
  const popup = getByRole("tooltip");
  expect(trigger.getAttribute("aria-describedby")).toBe(popup.id);
  await expect.poll(() => popup.getAttribute("data-side")).toBe("bottom");

  // Pressing the trigger asks the owner to close it.
  await user.click(trigger);
  expect(getByTestId("open").textContent).toBe("closed");
  await expect.poll(() => queryByRole("tooltip")).toBeNull();
  await user.click(getByRole("button", { name: "Toggle from outside" }));
  expect(getByRole("tooltip")).toBeTruthy();
  await user.keyboard("{Escape}");
  expect(getByTestId("open").textContent).toBe("closed");
});

test("the arrow points at the trigger's center and reports when it can't", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  const trigger = getByRole("button", { name: "Bold" });
  await user.hover(trigger);
  advance(600);
  vi.useRealTimers();
  const positioner = getByTestId("positioner");
  const arrow = getByTestId("arrow");
  await expect.poll(() => arrow.getAttribute("data-side")).toBe("top");
  expect(arrow.getAttribute("aria-hidden")).toBe("true");
  Object.defineProperty(arrow, "offsetWidth", { value: 10 });
  vi.spyOn(positioner, "getBoundingClientRect").mockReturnValue(rect(90, 40, 200, 40));
  const anchor = vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(rect(100, 100, 40, 20));

  // The positioner moving is what makes the arrow follow.
  positioner.style.setProperty("--moved", "1");
  await expect.poll(() => arrow.style.left).toBe("25px");
  expect(arrow.hasAttribute("data-uncentered")).toBe(false);

  anchor.mockReturnValue(rect(0, 100, 20, 20));
  positioner.style.setProperty("--moved", "2");
  await expect.poll(() => arrow.style.left).toBe("0px");
  expect(arrow.hasAttribute("data-uncentered")).toBe(true);
});

test("provider: its delay applies, and a trigger's own delay wins", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(provider);
  const undo = getByRole("button", { name: "Undo" });
  await user.hover(undo);
  advance(299);
  expect(isOpen(undo)).toBe(false);
  advance(1);
  expect(isOpen(undo)).toBe(true);
  await user.hover(getByTestId("outside"));
  advance(50);
  expect(isOpen(undo)).toBe(false);
  advance(1000);

  const share = getByRole("button", { name: "Share" });
  await user.hover(share);
  advance(999);
  expect(isOpen(share)).toBe(false);
  advance(1);
  expect(isOpen(share)).toBe(true);
});

test("provider: once one is open, the next opens at once and the first closes", async () => {
  const user = setup();
  const { getByRole } = mount(provider);
  const undo = getByRole("button", { name: "Undo" });
  const redo = getByRole("button", { name: "Redo" });
  await user.hover(undo);
  advance(300);
  expect(isOpen(undo)).toBe(true);

  await user.hover(redo);
  flush();
  expect(isOpen(redo)).toBe(true);
  expect(isOpen(undo)).toBe(false);
});

test("provider: within the timeout after closing the next opens at once, after it waits again", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(provider);
  const undo = getByRole("button", { name: "Undo" });
  const redo = getByRole("button", { name: "Redo" });
  const outside = getByTestId("outside");
  await user.hover(undo);
  advance(300);
  await user.hover(outside);
  advance(50);
  expect(isOpen(undo)).toBe(false);

  advance(300);
  await user.hover(redo);
  flush();
  expect(isOpen(redo)).toBe(true);

  await user.hover(outside);
  advance(50);
  advance(400);
  await user.hover(undo);
  flush();
  expect(isOpen(undo)).toBe(false);
  advance(300);
  expect(isOpen(undo)).toBe(true);
});
