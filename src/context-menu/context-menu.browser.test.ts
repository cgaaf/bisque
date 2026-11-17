import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";

type Mounted = ReturnType<typeof mount>;
const shown = (popup: HTMLElement) => popup.matches(":popover-open");

/** A real right-button press and release at `x`, `y` in `target` (the fixture's area starts at the viewport's 0,0). */
async function rightClick({ user }: Mounted, target: HTMLElement, x: number, y: number) {
  await user.click(target, { button: "right", position: { x, y } });
}

/** Whether the next `contextmenu` event that reaches the window was cancelled. */
function nextContextMenuCancelled(): Promise<boolean> {
  return new Promise((resolve) => {
    window.addEventListener("contextmenu", (event) => resolve(event.defaultPrevented), { once: true });
  });
}

async function placed(popup: HTMLElement) {
  await frame();
  const box = popup.getBoundingClientRect();
  return { left: Math.round(box.left), top: Math.round(box.top) };
}

test("right-click opens the menu at the pointer and suppresses the browser's menu", async () => {
  const m = mount(basic);
  const area = m.getByTestId("area");
  const popup = m.getByTestId("popup");
  expect(shown(popup)).toBe(false);
  const cancelled = nextContextMenuCancelled();
  await rightClick(m, area, 120, 80);
  expect(await cancelled).toBe(true);
  await expect.poll(() => shown(popup)).toBe(true);
  expect(m.getByRole("menu")).toBe(popup);
  expect(area.hasAttribute("data-popup-open")).toBe(true);
  await expect.poll(() => document.activeElement).toBe(popup);
  expect(m.getByTestId("changes").textContent).toBe("1");
  expect(await placed(popup)).toEqual({ left: 120, top: 80 });
});

test("right-clicking elsewhere while open moves the menu to the new point", async () => {
  const m = mount(basic);
  const area = m.getByTestId("area");
  const popup = m.getByTestId("popup");
  await rightClick(m, area, 120, 80);
  await expect.poll(() => shown(popup)).toBe(true);
  await rightClick(m, area, 40, 300);
  await frame();
  expect(shown(popup)).toBe(true);
  expect(await placed(popup)).toEqual({ left: 40, top: 300 });
  await expect.poll(() => document.activeElement).toBe(popup);
});

test("the browser flips it to stay in the viewport near the bottom-right corner", async () => {
  const m = mount(basic);
  const area = m.getByTestId("area");
  const popup = m.getByTestId("popup");
  const box = area.getBoundingClientRect();
  const x = Math.round(box.width - 10);
  const y = Math.round(box.height - 10);
  await rightClick(m, area, x, y);
  await expect.poll(() => shown(popup)).toBe(true);
  await frame();
  const menu = popup.getBoundingClientRect();
  // Above and to the left of the point: its bottom-right corner is there.
  expect(Math.round(menu.right)).toBe(x);
  expect(Math.round(menu.bottom)).toBe(y);
});

test("arrow keys, choosing an item and Escape work as in a menu", async () => {
  const m = mount(basic);
  const { getByTestId, getByRole, user } = m;
  const popup = getByTestId("popup");
  await rightClick(m, getByTestId("area"), 10, 10);
  await expect.poll(() => document.activeElement).toBe(popup);
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Copy" }));
  await user.keyboard("{ArrowDown}{Enter}");
  expect(getByTestId("chosen").textContent).toBe("paste");
  await expect.poll(() => shown(popup)).toBe(false);

  await rightClick(m, getByTestId("area"), 10, 10);
  await expect.poll(() => shown(popup)).toBe(true);
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
});

test("groups and radio items work inside a context menu", async () => {
  const m = mount(basic);
  await rightClick(m, m.getByTestId("area"), 10, 10);
  await expect.poll(() => shown(m.getByTestId("popup"))).toBe(true);
  expect(m.getByRole("group", { name: "Zoom" })).toBe(m.getByText("Zoom").parentElement);
  expect(m.getByRole("menuitemradio", { name: "Actual size" }).getAttribute("aria-checked")).toBe("true");
});

test("the context-menu key and Shift+F10 open it on the first item, below the focused element", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  const button = getByRole("button", { name: "Focus me" });
  const popup = getByTestId("popup");
  button.focus();
  await user.keyboard("{ContextMenu}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Copy" }));
  const below = button.getBoundingClientRect();
  expect(await placed(popup)).toEqual({ left: Math.round(below.left), top: Math.round(below.bottom) });

  // Closing puts focus back where it was.
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
  await expect.poll(() => document.activeElement).toBe(button);

  await user.keyboard("{Shift>}{F10}{/Shift}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Copy" }));
  expect(getByTestId("changes").textContent).toBe("3");
});

test("a press outside closes it", async () => {
  const m = mount(basic);
  const popup = m.getByTestId("popup");
  await rightClick(m, m.getByTestId("area"), 10, 10);
  await expect.poll(() => shown(popup)).toBe(true);
  await m.user.click(m.getByTestId("outside"));
  expect(shown(popup)).toBe(false);
  await expect.poll(() => m.getByTestId("area").hasAttribute("data-popup-open")).toBe(false);
});

test("submenus work inside a context menu", async () => {
  const m = mount(basic);
  const { getByTestId, getByRole, user } = m;
  await rightClick(m, getByTestId("area"), 10, 10);
  await expect.poll(() => document.activeElement).toBe(getByTestId("popup"));
  await user.keyboard("{End}{ArrowRight}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Inspect" }));
  expect(shown(getByTestId("sub-popup"))).toBe(true);
  await user.keyboard("{Enter}");
  expect(getByTestId("chosen").textContent).toBe("inspect");
  await expect.poll(() => shown(getByTestId("popup"))).toBe(false);
  expect(shown(getByTestId("sub-popup"))).toBe(false);
});

/** A touch event carrying one touch at `x`, `y`, for the long-press listener (not every engine has `Touch`). */
function touch(type: string, x: number, y: number): Event {
  const event = new Event(type, { bubbles: true });
  const touches = type === "touchend" ? [] : [{ clientX: x, clientY: y }];
  Object.defineProperty(event, "touches", { value: touches });
  return event;
}

test("a long press on touch opens it at the finger once the finger lifts; moving the finger cancels it", async () => {
  const { getByTestId } = mount(basic);
  const area = getByTestId("area");
  const popup = getByTestId("popup");
  area.dispatchEvent(touch("touchstart", 50, 60));
  await new Promise((resolve) => setTimeout(resolve, 200));
  area.dispatchEvent(touch("touchmove", 80, 60));
  await new Promise((resolve) => setTimeout(resolve, 500));
  area.dispatchEvent(touch("touchend", 80, 60));
  await frame();
  expect(shown(popup)).toBe(false);

  area.dispatchEvent(touch("touchstart", 50, 60));
  await new Promise((resolve) => setTimeout(resolve, 600));
  // Held past the delay: it opens on release, which would otherwise close it again.
  expect(shown(popup)).toBe(false);
  area.dispatchEvent(touch("touchend", 50, 60));
  await expect.poll(() => shown(popup)).toBe(true);
  // A 10x10 box from the finger: the popup sits below it.
  expect(await placed(popup)).toEqual({ left: 50, top: 70 });
});

test("a contextmenu raised on release (as on Windows) moves an open menu", async () => {
  const m = mount(basic);
  const area = m.getByTestId("area");
  const popup = m.getByTestId("popup");
  await rightClick(m, area, 120, 80);
  await expect.poll(() => shown(popup)).toBe(true);
  area.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      buttons: 0,
      clientX: 40,
      clientY: 300,
    }),
  );
  await expect.poll(() => shown(popup)).toBe(true);
  await expect.poll(() => placed(popup)).toEqual({ left: 40, top: 300 });
});

test("a contextmenu the keyboard's key raises after opening the menu is not a second request", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  const button = getByRole("button", { name: "Focus me" });
  const popup = getByTestId("popup");
  button.focus();
  await user.keyboard("{ContextMenu}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Copy" }));
  const before = await placed(popup);
  const changes = getByTestId("changes").textContent;
  button.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 0, buttons: 0 }),
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(shown(popup)).toBe(true);
  expect(await placed(popup)).toEqual(before);
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Copy" }));
  expect(getByTestId("changes").textContent).toBe(changes);
});

test("a disabled context menu leaves the browser's menu alone and doesn't open", async () => {
  const m = mount(basic);
  const area = m.getByTestId("disabled-area");
  expect(area.hasAttribute("data-disabled")).toBe(true);
  // A listener that runs last stops the browser's own menu from covering the page in a headed run.
  const cancelled = new Promise<boolean>((resolve) => {
    window.addEventListener(
      "contextmenu",
      (event) => {
        resolve(event.defaultPrevented);
        event.preventDefault();
      },
      { once: true },
    );
  });
  await rightClick(m, area, 5, 5);
  expect(await cancelled).toBe(false);
  await frame();
  expect(shown(m.getByTestId("disabled-popup"))).toBe(false);
});
