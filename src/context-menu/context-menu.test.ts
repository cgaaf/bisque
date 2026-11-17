import { fireEvent } from "@testing-library/dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { flush, mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

// jsdom's viewport is 0x0, so collision handling would push every popup to the corner: give it a size.
beforeEach(() => {
  vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1000);
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(800);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function rightClick(target: Element, clientX: number, clientY: number): boolean {
  fireEvent.pointerDown(target, { button: 2, clientX, clientY });
  // A browser dispatches the two events as separate tasks, so the press's dismissal lands first.
  flush();
  const notCancelled = fireEvent.contextMenu(target, { button: 2, clientX, clientY });
  flush();
  return notCancelled;
}

/** The point the positioner's virtual anchor reports: what `computePosition` was asked to place against. */
async function placedAt(positioner: HTMLElement) {
  await expect.poll(() => positioner.style.left).not.toMatch(/^0(px)?$/);
  return { left: positioner.style.left, top: positioner.style.top };
}

test("right-click opens the menu at the pointer and suppresses the browser's menu", async () => {
  const { getByTestId, getByRole, queryByRole } = mount(basic);
  const area = getByTestId("area");
  expect(queryByRole("menu")).toBeNull();
  const notCancelled = rightClick(area, 120, 80);
  expect(notCancelled).toBe(false);
  const popup = getByRole("menu");
  expect(area.hasAttribute("data-popup-open")).toBe(true);
  expect(document.activeElement).toBe(popup);
  expect(getByTestId("changes").textContent).toBe("1");
  // jsdom has no layout: the popup is 0x0, so it lands exactly on the point.
  expect(await placedAt(getByTestId("positioner"))).toEqual({ left: "120px", top: "80px" });
  expect(getByTestId("positioner").getAttribute("data-side")).toBe("bottom");
});

test("right-clicking elsewhere while open moves the menu to the new point", async () => {
  const { getByTestId, getByRole } = mount(basic);
  const area = getByTestId("area");
  rightClick(area, 120, 80);
  await placedAt(getByTestId("positioner"));
  rightClick(area, 300, 200);
  await expect.poll(() => getByTestId("positioner").style.left).toBe("300px");
  expect(getByTestId("positioner").style.top).toBe("200px");
  expect(getByRole("menu")).toBeTruthy();
});

test("arrow keys, choosing an item and Escape work as in a menu", async () => {
  const { getByTestId, getByRole, queryByRole, user } = mount(basic);
  rightClick(getByTestId("area"), 10, 10);
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Copy" }));
  await user.keyboard("{ArrowDown}{Enter}");
  expect(getByTestId("chosen").textContent).toBe("paste");
  await expect.poll(() => queryByRole("menu")).toBeNull();

  rightClick(getByTestId("area"), 10, 10);
  await user.keyboard("{Escape}");
  await expect.poll(() => queryByRole("menu")).toBeNull();
});

test("groups and radio items work inside a context menu", async () => {
  const { getByTestId, getByRole, getByText } = mount(basic);
  rightClick(getByTestId("area"), 10, 10);
  expect(getByRole("group", { name: "Zoom" })).toBe(getByText("Zoom").parentElement);
  expect(getByRole("menuitemradio", { name: "Actual size" }).getAttribute("aria-checked")).toBe("true");
});

test("the context-menu key and Shift+F10 open it on the first item, below the focused element", async () => {
  const { getByTestId, getByRole, queryByRole, user } = mount(basic);
  const button = getByRole("button", { name: "Focus me" });
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
    left: 40,
    top: 50,
    right: 100,
    bottom: 70,
    width: 60,
    height: 20,
    x: 40,
    y: 50,
    toJSON: () => ({}),
  } as DOMRect);
  button.focus();
  await user.keyboard("{ContextMenu}");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Copy" }));
  expect(await placedAt(getByTestId("positioner"))).toEqual({ left: "40px", top: "70px" });

  // Closing puts focus back where it was.
  await user.keyboard("{Escape}");
  await expect.poll(() => queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(button);

  await user.keyboard("{Shift>}{F10}{/Shift}");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Copy" }));
});

test("a press outside closes it", async () => {
  const { getByTestId, queryByRole, user } = mount(basic);
  rightClick(getByTestId("area"), 10, 10);
  await user.click(getByTestId("outside"));
  await expect.poll(() => queryByRole("menu")).toBeNull();
});

test("submenus work inside a context menu", async () => {
  const { getByTestId, getByRole, queryByRole, user } = mount(basic);
  rightClick(getByTestId("area"), 10, 10);
  await user.keyboard("{End}{ArrowRight}");
  expect(getByTestId("sub-popup")).toBeTruthy();
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Inspect" }));
  await user.keyboard("{Enter}");
  expect(getByTestId("chosen").textContent).toBe("inspect");
  await expect.poll(() => queryByRole("menu")).toBeNull();
});

test("a long press on touch opens it at the finger; moving the finger cancels it", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const { getByTestId, queryByRole } = mount(basic);
  const area = getByTestId("area");
  fireEvent.touchStart(area, { touches: [{ clientX: 50, clientY: 60 }] });
  vi.advanceTimersByTime(300);
  fireEvent.touchMove(area, { touches: [{ clientX: 80, clientY: 60 }] });
  vi.advanceTimersByTime(500);
  flush();
  expect(queryByRole("menu")).toBeNull();

  fireEvent.touchStart(area, { touches: [{ clientX: 50, clientY: 60 }] });
  vi.advanceTimersByTime(499);
  flush();
  expect(queryByRole("menu")).toBeNull();
  vi.advanceTimersByTime(1);
  flush();
  expect(queryByRole("menu")).toBeTruthy();
  vi.useRealTimers();
  // A 10x10 box around the finger: the popup sits below it.
  expect(await placedAt(getByTestId("positioner"))).toEqual({ left: "50px", top: "70px" });
});

test("a disabled context menu leaves the browser's menu alone and doesn't open", () => {
  const { getByTestId, queryByTestId } = mount(basic);
  const area = getByTestId("disabled-area");
  expect(area.hasAttribute("data-disabled")).toBe(true);
  expect(rightClick(area, 10, 10)).toBe(true);
  expect(queryByTestId("disabled-popup")).toBeNull();
});
