import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { flush, mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import right from "./fixtures/right.rx";
import demo from "./fixtures/demo.rx";

// jsdom has no layout: the popup is 200px tall and 300px wide.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("role") === "dialog" ? 200 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("role") === "dialog" ? 300 : 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function pointer(target: Element, type: string, x: number, y: number, pointerType = "touch") {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      button: 0,
      pointerType,
      clientX: x,
      clientY: y,
    }),
  );
  flush();
}

/** A drag that takes its time, so its speed alone never dismisses: 100ms between each point. */
function slowDrag(target: Element, path: [number, number][], pointerType = "touch") {
  vi.useFakeTimers({ toFake: ["Date"] });
  const [first, ...rest] = path;
  pointer(target, "pointerdown", ...first, pointerType);
  for (const point of rest) {
    vi.advanceTimersByTime(100);
    pointer(target, "pointermove", ...point, pointerType);
  }
}

async function openDrawer() {
  const mounted = mount(basic);
  await mounted.user.click(mounted.getByRole("button", { name: "Open drawer" }));
  return mounted;
}

test("is a dialog: opens in a portal, labelled, modal, focus moved in", async () => {
  const { getByRole, getByText, getByTestId, container } = await openDrawer();
  const popup = getByRole("dialog");
  expect(container.contains(popup)).toBe(false);
  expect(popup.getAttribute("aria-modal")).toBe("true");
  expect(popup.getAttribute("aria-labelledby")).toBe(getByText("Filters").id);
  expect(popup.getAttribute("aria-describedby")).toBe(getByText("Narrow the results.").id);
  expect(popup.getAttribute("data-swipe-direction")).toBe("down");
  expect(popup.hasAttribute("data-open")).toBe(true);
  expect(getByTestId("viewport").getAttribute("role")).toBe("presentation");
  expect(document.activeElement).toBe(getByRole("button", { name: "Done" }));
});

test("closes with its close button and Escape, returning focus to the trigger", async () => {
  const { getByRole, queryByRole, getByTestId, user } = await openDrawer();
  await user.click(getByRole("button", { name: "Done" }));
  await expect.poll(() => queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(getByRole("button", { name: "Open drawer" }));
  await user.click(getByRole("button", { name: "Open drawer" }));
  await user.keyboard("{Escape}");
  await expect.poll(() => queryByRole("dialog")).toBeNull();
  expect(getByTestId("changes").textContent).toBe("open,close,open,close");
});

test("while dragged, exposes the movement and progress, on the popup and the backdrop", async () => {
  const { getByRole, getByTestId } = await openDrawer();
  const popup = getByRole("dialog");
  const backdrop = getByTestId("backdrop");
  slowDrag(getByTestId("handle"), [
    [50, 100],
    [50, 130],
    [50, 160],
  ]);
  expect(popup.hasAttribute("data-swiping")).toBe(true);
  expect(backdrop.hasAttribute("data-swiping")).toBe(true);
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("60px");
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-x")).toBe("0px");
  expect(popup.style.getPropertyValue("--drawer-swipe-progress")).toBe("0.3");
  expect(backdrop.style.getPropertyValue("--drawer-swipe-progress")).toBe("0.3");
});

test("snaps back when let go short of half its height", async () => {
  const { getByRole, getByTestId } = await openDrawer();
  const popup = getByRole("dialog");
  const handle = getByTestId("handle");
  slowDrag(handle, [
    [50, 100],
    [50, 150],
    [50, 199],
  ]);
  pointer(handle, "pointerup", 50, 199);
  expect(popup.hasAttribute("data-open")).toBe(true);
  expect(popup.hasAttribute("data-swiping")).toBe(false);
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("0px");
  expect(popup.style.getPropertyValue("--drawer-swipe-progress")).toBe("0");
  expect(getByTestId("changes").textContent).toBe("open");
});

test("a swipe past half its height dismisses it", async () => {
  const { getByRole, queryByRole, getByTestId } = await openDrawer();
  const popup = getByRole("dialog");
  const handle = getByTestId("handle");
  slowDrag(handle, [
    [50, 100],
    [50, 150],
    [50, 210],
  ]);
  pointer(handle, "pointerup", 50, 210);
  expect(popup.hasAttribute("data-closed")).toBe(true);
  expect(popup.hasAttribute("data-swipe-dismiss")).toBe(true);
  // It leaves from where it was let go.
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("110px");
  expect(getByTestId("changes").textContent).toBe("open,close");
  await expect.poll(() => queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(getByRole("button", { name: "Open drawer" }));
});

test("a fast flick dismisses it, however short", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const { getByRole, getByTestId } = await openDrawer();
  const handle = getByTestId("handle");
  pointer(handle, "pointerdown", 50, 100);
  vi.advanceTimersByTime(20);
  pointer(handle, "pointermove", 50, 130);
  pointer(handle, "pointerup", 50, 130);
  expect(getByRole("dialog", { hidden: true }).hasAttribute("data-closed")).toBe(true);
});

test("dragging the other way is damped and never dismisses", async () => {
  const { getByRole, getByTestId } = await openDrawer();
  const popup = getByRole("dialog");
  const handle = getByTestId("handle");
  slowDrag(handle, [
    [50, 200],
    [50, 100],
  ]);
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("-10px");
  expect(popup.style.getPropertyValue("--drawer-swipe-progress")).toBe("0");
  pointer(handle, "pointerup", 50, 100);
  expect(popup.hasAttribute("data-open")).toBe(true);
});

test("a mouse press in DrawerContent selects text instead of swiping; touch still swipes", async () => {
  const { getByRole, getByTestId } = await openDrawer();
  const popup = getByRole("dialog");
  const content = getByTestId("content");
  slowDrag(
    content,
    [
      [50, 100],
      [50, 180],
    ],
    "mouse",
  );
  expect(popup.hasAttribute("data-swiping")).toBe(false);
  pointer(content, "pointerup", 50, 180, "mouse");
  slowDrag(content, [
    [50, 100],
    [50, 180],
  ]);
  expect(popup.hasAttribute("data-swiping")).toBe(true);
});

test("opening again starts from rest", async () => {
  const { getByRole, queryByRole, getByTestId, user } = await openDrawer();
  const handle = getByTestId("handle");
  slowDrag(handle, [
    [50, 100],
    [50, 250],
  ]);
  pointer(handle, "pointerup", 50, 250);
  await expect.poll(() => queryByRole("dialog")).toBeNull();
  vi.useRealTimers();
  await user.click(getByRole("button", { name: "Open drawer" }));
  const popup = getByRole("dialog");
  expect(popup.hasAttribute("data-swipe-dismiss")).toBe(false);
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("0px");
});

test("swipeDirection and swipeThreshold: a controlled drawer swiped out to the right", () => {
  const { getByRole, getByTestId } = mount(right);
  const popup = getByRole("dialog");
  expect(popup.getAttribute("data-swipe-direction")).toBe("right");
  slowDrag(popup, [
    [10, 10],
    [40, 10],
  ]);
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-x")).toBe("30px");
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("0px");
  expect(popup.style.getPropertyValue("--drawer-swipe-progress")).toBe("0.1");
  pointer(popup, "pointerup", 40, 10);
  expect(getByTestId("open").textContent).toBe("open");
  slowDrag(popup, [
    [10, 10],
    [70, 10],
  ]);
  pointer(popup, "pointerup", 70, 10);
  expect(getByTestId("open").textContent).toBe("closed");
});

test("the demo opens and closes", async () => {
  const { getByRole, queryByRole, user } = mount(demo);
  await user.click(getByRole("button", { name: "Open filters" }));
  expect(getByRole("dialog").getAttribute("data-swipe-direction")).toBe("down");
  await user.click(getByRole("button", { name: "Done" }));
  await expect.poll(() => queryByRole("dialog")).toBeNull();
});

test("a touch drag keeps the page from scrolling, and only while it lasts", async () => {
  const { getByTestId } = await openDrawer();
  const handle = getByTestId("handle");
  const touchMove = () => {
    const event = new Event("touchmove", { bubbles: true, cancelable: true });
    handle.dispatchEvent(event);
    return event.defaultPrevented;
  };
  expect(touchMove()).toBe(false);
  slowDrag(handle, [
    [50, 100],
    [50, 120],
  ]);
  expect(touchMove()).toBe(true);
  pointer(handle, "pointerup", 50, 120);
  expect(touchMove()).toBe(false);
});
