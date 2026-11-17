import { fireEvent } from "@testing-library/dom";
import { expect, test } from "vitest";
import { flush, mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

type Geometry = { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };

/** jsdom has no layout: give the viewport sizes and a scroll position that scrolls as a browser's would. */
function stubViewport(viewport: HTMLElement, geometry: Geometry) {
  const position = { top: 0, left: 0 };
  for (const [key, value] of Object.entries(geometry)) {
    Object.defineProperty(viewport, key, { configurable: true, get: () => value });
  }
  const scrollable = (key: "top" | "left", max: number) => ({
    configurable: true,
    get: () => position[key],
    set: (value: number) => {
      position[key] = Math.min(Math.max(value, 0), max);
      scrolled(viewport);
    },
  });
  Object.defineProperty(
    viewport,
    "scrollTop",
    scrollable("top", geometry.scrollHeight - geometry.clientHeight),
  );
  Object.defineProperty(
    viewport,
    "scrollLeft",
    scrollable("left", geometry.scrollWidth - geometry.clientWidth),
  );
}

/** A browser fires `scroll` after the position changes; reactive updates from it are applied at once here. */
function scrolled(viewport: HTMLElement) {
  viewport.dispatchEvent(new Event("scroll"));
  flush();
}

/** Fires a pointer event and applies what it changed. */
function pointer(type: "pointerDown" | "pointerMove" | "pointerUp", element: HTMLElement, init: object) {
  fireEvent[type](element, init);
  flush();
}

function stubSize(element: HTMLElement, width: number, height: number) {
  Object.defineProperty(element, "offsetWidth", { configurable: true, get: () => width });
  Object.defineProperty(element, "offsetHeight", { configurable: true, get: () => height });
  element.getBoundingClientRect = () => new DOMRect(0, 0, width, height);
}

/** Mounts the fixture with a viewport that overflows both ways, and scrollbars that have a length. */
function mountOverflowing() {
  const mounted = mount(basic);
  const viewport = mounted.getByTestId("viewport");
  stubViewport(viewport, { scrollHeight: 400, clientHeight: 100, scrollWidth: 200, clientWidth: 100 });
  scrolled(viewport);
  stubSize(mounted.getByTestId("scrollbar-y"), 10, 100);
  stubSize(mounted.getByTestId("scrollbar-x"), 100, 12);
  scrolled(viewport);
  return { ...mounted, viewport };
}

test("renders no scrollbars while nothing overflows", () => {
  const { getByTestId, queryByTestId } = mount(basic);
  const viewport = getByTestId("viewport");
  expect(getByTestId("root").getAttribute("role")).toBe("presentation");
  expect(getByTestId("root").className).toBe("mine");
  expect(viewport.style.overflow).toBe("scroll");
  expect(viewport.getAttribute("tabindex")).toBe("-1");
  expect(getByTestId("content").style.minWidth).toBe("fit-content");
  expect(queryByTestId("scrollbar-y")).toBeNull();
  expect(queryByTestId("scrollbar-x")).toBeNull();
  expect(queryByTestId("corner")).toBeNull();
  // `keepMounted` keeps one anyway.
  expect(getByTestId("kept").getAttribute("aria-hidden")).toBe("true");
});

test("shows scrollbars and the corner once the content overflows", () => {
  const { getByTestId, viewport } = mountOverflowing();
  const root = getByTestId("root");
  expect(root.hasAttribute("data-has-overflow-x")).toBe(true);
  expect(root.hasAttribute("data-has-overflow-y")).toBe(true);
  expect(viewport.getAttribute("tabindex")).toBe("0");
  expect(getByTestId("scrollbar-y").getAttribute("data-orientation")).toBe("vertical");
  expect(getByTestId("scrollbar-x").getAttribute("data-orientation")).toBe("horizontal");
  const corner = getByTestId("corner");
  expect(corner.style.width).toBe("10px");
  expect(corner.style.height).toBe("12px");
  expect(root.style.getPropertyValue("--scroll-area-corner-width")).toBe("10px");
  expect(root.style.getPropertyValue("--scroll-area-corner-height")).toBe("12px");
});

test("sizes and moves the thumbs from the viewport's scroll position", () => {
  const { getByTestId, viewport } = mountOverflowing();
  const scrollbarY = getByTestId("scrollbar-y");
  const thumbY = getByTestId("thumb-y");
  // A quarter of the content is visible: a quarter of the 100px track.
  expect(scrollbarY.style.getPropertyValue("--scroll-area-thumb-height")).toBe("25px");
  expect(thumbY.style.height).toBe("var(--scroll-area-thumb-height)");
  expect(thumbY.style.transform).toBe("translate3d(0px, 0px, 0px)");
  expect(getByTestId("scrollbar-x").style.getPropertyValue("--scroll-area-thumb-width")).toBe("50px");

  viewport.scrollTop = 150;
  expect(thumbY.style.transform).toBe("translate3d(0px, 37.5px, 0px)");
  expect(viewport.style.getPropertyValue("--scroll-area-overflow-y-start")).toBe("150px");
  expect(viewport.style.getPropertyValue("--scroll-area-overflow-y-end")).toBe("150px");
  viewport.scrollLeft = 100;
  expect(getByTestId("thumb-x").style.transform).toBe("translate3d(50px, 0px, 0px)");
});

test("marks the overflowing edges past the threshold", () => {
  const { getByTestId, viewport } = mountOverflowing();
  const root = getByTestId("root");
  expect(root.hasAttribute("data-overflow-y-start")).toBe(false);
  expect(root.hasAttribute("data-overflow-y-end")).toBe(true);
  expect(root.hasAttribute("data-overflow-x-start")).toBe(false);
  expect(root.hasAttribute("data-overflow-x-end")).toBe(true);
  viewport.scrollTop = 5;
  expect(root.hasAttribute("data-overflow-y-start")).toBe(false);
  viewport.scrollTop = 295;
  expect(root.hasAttribute("data-overflow-y-start")).toBe(true);
  expect(root.hasAttribute("data-overflow-y-end")).toBe(false);
  expect(viewport.hasAttribute("data-overflow-y-start")).toBe(true);
});

test("is `data-scrolling` while it scrolls, on the axis that moved", async () => {
  const { getByTestId, viewport } = mountOverflowing();
  viewport.scrollTop = 40;
  expect(getByTestId("root").hasAttribute("data-scrolling")).toBe(true);
  expect(viewport.hasAttribute("data-scrolling")).toBe(true);
  expect(getByTestId("scrollbar-y").hasAttribute("data-scrolling")).toBe(true);
  expect(getByTestId("thumb-y").hasAttribute("data-scrolling")).toBe(true);
  expect(getByTestId("scrollbar-x").hasAttribute("data-scrolling")).toBe(false);
  await expect.poll(() => getByTestId("root").hasAttribute("data-scrolling"), { timeout: 2000 }).toBe(false);
});

test("is `data-hovering` while the pointer is over the root", async () => {
  const { getByTestId, user, viewport } = mountOverflowing();
  const scrollbarY = getByTestId("scrollbar-y");
  expect(scrollbarY.hasAttribute("data-hovering")).toBe(false);
  await user.hover(viewport);
  expect(scrollbarY.hasAttribute("data-hovering")).toBe(true);
  expect(getByTestId("scrollbar-x").hasAttribute("data-hovering")).toBe(true);
  await user.unhover(viewport);
  expect(scrollbarY.hasAttribute("data-hovering")).toBe(false);
});

test("dragging a thumb scrolls the viewport in proportion", () => {
  const { getByTestId, viewport } = mountOverflowing();
  viewport.scrollTop = 150;
  const thumbY = getByTestId("thumb-y");
  pointer("pointerDown", thumbY, { button: 0, pointerId: 1, clientY: 0 });
  // The thumb has 75px to travel for 300px of scroll: 15px of drag is 60px of scroll.
  pointer("pointerMove", thumbY, { pointerId: 1, clientY: 15 });
  expect(viewport.scrollTop).toBe(210);
  expect(thumbY.style.transform).toBe("translate3d(0px, 52.5px, 0px)");
  // Another pointer doesn't move it.
  pointer("pointerMove", thumbY, { pointerId: 2, clientY: 50 });
  expect(viewport.scrollTop).toBe(210);
  pointer("pointerUp", thumbY, { pointerId: 1, clientY: 15 });
  pointer("pointerMove", thumbY, { pointerId: 1, clientY: 40 });
  expect(viewport.scrollTop).toBe(210);

  const thumbX = getByTestId("thumb-x");
  pointer("pointerDown", thumbX, { button: 0, pointerId: 3, clientX: 0 });
  pointer("pointerMove", thumbX, { pointerId: 3, clientX: 25 });
  expect(viewport.scrollLeft).toBe(50);
});

test("pressing the track centres the thumb on the pointer", () => {
  const { getByTestId, viewport } = mountOverflowing();
  const scrollbarY = getByTestId("scrollbar-y");
  pointer("pointerDown", scrollbarY, { button: 0, pointerId: 1, clientY: 50 });
  // (50 - 12.5) / 75 of the way down.
  expect(viewport.scrollTop).toBe(150);
  // A press on the thumb is a drag, not a jump.
  pointer("pointerDown", getByTestId("thumb-y"), { button: 0, pointerId: 2, clientY: 99 });
  expect(viewport.scrollTop).toBe(150);
});

test("the wheel over a scrollbar scrolls the viewport", () => {
  const { getByTestId, viewport } = mountOverflowing();
  const scrollbarY = getByTestId("scrollbar-y");
  const event = new WheelEvent("wheel", { deltaY: 40, bubbles: true, cancelable: true });
  scrollbarY.dispatchEvent(event);
  flush();
  expect(viewport.scrollTop).toBe(40);
  expect(event.defaultPrevented).toBe(true);
  // At the top, scrolling further up is left to the page.
  viewport.scrollTop = 0;
  const up = new WheelEvent("wheel", { deltaY: -40, bubbles: true, cancelable: true });
  scrollbarY.dispatchEvent(up);
  flush();
  expect(up.defaultPrevented).toBe(false);
});
