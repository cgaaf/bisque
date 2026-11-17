import { OBSERVE } from "solid-js";
import { attribution } from "solid-js/attribution";
import { afterEach, expect, test, vi } from "vitest";
import { server } from "vitest/browser";
import { flush, frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import right from "./fixtures/right.rx";
import nativeClose from "./fixtures/native-close.rx";

afterEach(() => {
  vi.useRealTimers();
});

/**
 * The EFFECT_RELAY_TEAR reports about signals of `primitive` while `run` runs. Solid checks for an effect that
 * relays a change into a signal only while its attribution engine is on, which Vitest doesn't do, and reports the
 * first two sightings at `info`, on the structured channel only: the console, and so `src/test/browser-setup.ts`,
 * would see the third.
 */
async function relayTears(primitive: string, run: () => Promise<void>): Promise<string[]> {
  // OBSERVE exists in Solid's dev and observe builds, which are what tests run on.
  const capture = OBSERVE!.diagnostics.capture();
  const release = attribution.enable({ log: false });
  try {
    await run();
  } finally {
    release();
  }
  type Diagnostic = { code: string; message: string; data?: { wrote?: string } };
  return (capture.stop() as Diagnostic[])
    .filter((event) => event.code === "EFFECT_RELAY_TEAR" && event.data?.wrote?.startsWith(`${primitive}.`))
    .map((event) => event.message);
}

const closed = (dialog: HTMLElement) => expect.poll(() => (dialog as HTMLDialogElement).open).toBe(false);

/** A pointer event at `(dx, dy)` from the top-left of `target`'s box. */
function pointer(target: Element, type: string, dx: number, dy: number, pointerType = "touch") {
  const box = target.getBoundingClientRect();
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      button: 0,
      pointerType,
      clientX: box.left + dx,
      clientY: box.top + dy,
    }),
  );
  flush();
}

/**
 * A drag that takes its time, so its speed alone never dismisses: 100ms between each point. The points are
 * relative to where `target` was when the drag started.
 */
function slowDrag(target: Element, path: [number, number][], pointerType = "touch") {
  vi.useFakeTimers({ toFake: ["Date"] });
  const box = target.getBoundingClientRect();
  const at = (type: string, [x, y]: [number, number]) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        button: 0,
        pointerType,
        clientX: box.left + x,
        clientY: box.top + y,
      }),
    );
  const [first, ...rest] = path;
  at("pointerdown", first);
  flush();
  for (const point of rest) {
    vi.advanceTimersByTime(100);
    at("pointermove", point);
    flush();
  }
  return (point: [number, number]) => {
    at("pointerup", point);
    flush();
  };
}

/** A pointer event of a mouse, on whatever is at the point, as a real one would be. */
function firePointer(type: string, px: number, py: number) {
  const target = document.elementFromPoint(px, py) ?? document.documentElement;
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      pointerType: "mouse",
      clientX: px,
      clientY: py,
    }),
  );
  flush();
}

/**
 * A mouse drag from `start` (a point in `from`'s box) by `by` px. In Chromium and WebKit it is real input. In
 * Firefox the events are dispatched instead: test files run side by side there, and a real drag in one disturbs
 * the pointer and focus of the others (Dialog's own tests fail beside it).
 */
async function mouseDrag(
  user: { dragAndDrop: (...args: never[]) => Promise<void> },
  from: Element,
  start: { x: number; y: number },
  by: { x: number; y: number },
  // Where a real drag is dropped: the end point must land on this element (or what it contains).
  target: Element = from,
) {
  const box = from.getBoundingClientRect();
  const x = box.left + start.x;
  const y = box.top + start.y;
  if (server.browser !== "firefox") {
    const drop = target.getBoundingClientRect();
    await user.dragAndDrop(
      from as never,
      target as never,
      {
        sourcePosition: start,
        targetPosition: { x: x + by.x - drop.left, y: y + by.y - drop.top },
        steps: 10,
      } as never,
    );
    return;
  }
  firePointer("pointerdown", x, y);
  for (let step = 1; step <= 10; step += 1)
    firePointer("pointermove", x + (by.x * step) / 10, y + (by.y * step) / 10);
  firePointer("pointerup", x + by.x, y + by.y);
  await frame();
}

async function openDrawer() {
  const mounted = mount(basic);
  const trigger = mounted.getByRole("button", { name: "Open drawer" });
  // From the keyboard: Safari doesn't focus a clicked button, so focus would have nowhere to return.
  trigger.focus();
  await mounted.user.keyboard("{Enter}");
  return { ...mounted, trigger, popup: mounted.getByTestId("popup") as HTMLDialogElement };
}

test("is a modal <dialog>: labelled, focus moved in, no portal", async () => {
  const { getByText, getByRole, container, popup } = await openDrawer();
  expect(popup.tagName).toBe("DIALOG");
  expect(popup.open).toBe(true);
  expect(popup.matches(":modal")).toBe(true);
  expect(container.contains(popup)).toBe(true);
  expect(popup.getAttribute("aria-labelledby")).toBe(getByText("Filters").id);
  expect(popup.getAttribute("aria-describedby")).toBe(getByText("Narrow the results.").id);
  expect(popup.getAttribute("data-swipe-direction")).toBe("down");
  expect(popup.contains(document.activeElement)).toBe(true);
  expect(getByRole("dialog", { name: "Filters" })).toBe(popup);
});

test("closes with its close button and Escape, returning focus to the trigger", async () => {
  const { getByRole, getByTestId, user, trigger, popup } = await openDrawer();
  await user.click(getByRole("button", { name: "Done" }));
  await closed(popup);
  expect(document.activeElement).toBe(trigger);
  await user.keyboard("{Enter}");
  expect(popup.open).toBe(true);
  await user.keyboard("{Escape}");
  await closed(popup);
  expect(document.activeElement).toBe(trigger);
  expect(getByTestId("changes").textContent).toBe("open,close,open,close");
});

test("while dragged, exposes the movement and progress, which the ::backdrop inherits", async () => {
  const { getByTestId, popup } = await openDrawer();
  const release = slowDrag(getByTestId("handle"), [
    [50, 10],
    [50, 40],
    [50, 70],
  ]);
  expect(popup.hasAttribute("data-swiping")).toBe(true);
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("60px");
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-x")).toBe("0px");
  // 60px of a 200px-tall drawer, measured from its real layout.
  expect(popup.style.getPropertyValue("--drawer-swipe-progress")).toBe("0.3");
  expect(getComputedStyle(popup, "::backdrop").getPropertyValue("--drawer-swipe-progress").trim()).toBe(
    "0.3",
  );
  expect(getComputedStyle(popup, "::backdrop").opacity).toBe("0.7");
  release([50, 70]);
});

test("snaps back when let go short of half its height", async () => {
  const { getByTestId, popup } = await openDrawer();
  const release = slowDrag(getByTestId("handle"), [
    [50, 10],
    [50, 60],
    [50, 109],
  ]);
  release([50, 109]);
  expect(popup.open).toBe(true);
  expect(popup.hasAttribute("data-swiping")).toBe(false);
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("0px");
  expect(popup.style.getPropertyValue("--drawer-swipe-progress")).toBe("0");
  expect(getByTestId("changes").textContent).toBe("open");
});

test("a mouse drag past half its height dismisses it, and it leaves from where it was let go", async () => {
  const { getByTestId, user, trigger, popup } = await openDrawer();
  await mouseDrag(user, getByTestId("handle"), { x: 50, y: 10 }, { x: 0, y: 140 }, popup);
  expect(popup.hasAttribute("data-swipe-dismiss")).toBe(true);
  expect(getByTestId("changes").textContent).toBe("open,close");
  // Still open, sliding out under data-ending-style from the offset it was released at.
  expect(popup.hasAttribute("data-ending-style")).toBe(true);
  expect(Number.parseFloat(popup.style.getPropertyValue("--drawer-swipe-movement-y"))).toBeGreaterThan(100);
  await closed(popup);
  expect(document.activeElement).toBe(trigger);
});

test("a mouse drag that is short and slow snaps back", async () => {
  // A frozen clock makes the speed 20px / 50ms, under the 0.5 px/ms that counts as a flick.
  vi.useFakeTimers({ toFake: ["Date"] });
  const { getByTestId, user, popup } = await openDrawer();
  await mouseDrag(user, getByTestId("handle"), { x: 50, y: 10 }, { x: 0, y: 20 }, popup);
  await frame();
  expect(popup.open).toBe(true);
  expect(popup.hasAttribute("data-ending-style")).toBe(false);
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("0px");
});

test("a fast flick dismisses it, however short", async () => {
  const { getByTestId, popup } = await openDrawer();
  vi.useFakeTimers({ toFake: ["Date"] });
  const handle = getByTestId("handle");
  pointer(handle, "pointerdown", 50, 10);
  vi.advanceTimersByTime(20);
  pointer(handle, "pointermove", 50, 40);
  pointer(handle, "pointerup", 50, 40);
  expect(popup.hasAttribute("data-swipe-dismiss")).toBe(true);
  await closed(popup);
});

test("dragging the other way is damped and never dismisses", async () => {
  const { getByTestId, popup } = await openDrawer();
  const release = slowDrag(getByTestId("handle"), [
    [50, 30],
    [50, -70],
  ]);
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("-10px");
  expect(popup.style.getPropertyValue("--drawer-swipe-progress")).toBe("0");
  release([50, -70]);
  expect(popup.open).toBe(true);
});

test("a mouse drag in DrawerContent selects text instead of swiping; touch still swipes", async () => {
  const { getByTestId, user, popup } = await openDrawer();
  const content = getByTestId("content");
  await mouseDrag(user, content, { x: 50, y: 5 }, { x: 0, y: 100 }, popup);
  await frame();
  expect(popup.open).toBe(true);
  expect(popup.hasAttribute("data-swipe-dismiss")).toBe(false);
  const release = slowDrag(content, [
    [50, 5],
    [50, 85],
  ]);
  expect(popup.hasAttribute("data-swiping")).toBe(true);
  release([50, 85]);
});

test("a press on the backdrop closes it without starting a swipe", async () => {
  const { user, popup } = await openDrawer();
  await user.click(document.body, { position: { x: 5, y: 5 } });
  expect(popup.hasAttribute("data-swiping")).toBe(false);
  expect(popup.hasAttribute("data-swipe-dismiss")).toBe(false);
  await closed(popup);
});

test("a drag that starts on the backdrop is not a swipe", async () => {
  const { getByTestId, user, popup } = await openDrawer();
  // A press above the drawer lands on its ::backdrop, which targets the <dialog> itself.
  await mouseDrag(user, popup, { x: 50, y: -150 }, { x: 0, y: 300 });
  await frame();
  expect(popup.hasAttribute("data-swipe-dismiss")).toBe(false);
  expect(getByTestId("changes").textContent).toBe("open");
});

test("opening again starts from rest", async () => {
  const { getByTestId, user, popup } = await openDrawer();
  const release = slowDrag(getByTestId("handle"), [
    [50, 10],
    [50, 160],
  ]);
  release([50, 160]);
  await closed(popup);
  vi.useRealTimers();
  await user.keyboard("{Enter}");
  expect(popup.open).toBe(true);
  expect(popup.hasAttribute("data-swipe-dismiss")).toBe(false);
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("0px");
});

test("opening resets the swipe without relaying the change through an effect", async () => {
  const tears = await relayTears("createSwipe", async () => {
    const { getByRole, getByTestId, user, popup } = await openDrawer();
    await user.click(getByRole("button", { name: "Done" }));
    await closed(popup);
    await user.keyboard("{Enter}");
    expect(popup.open).toBe(true);
    const release = slowDrag(getByTestId("handle"), [
      [50, 10],
      [50, 160],
    ]);
    release([50, 160]);
    await closed(popup);
    vi.useRealTimers();
    await user.keyboard("{Enter}");
    expect(popup.open).toBe(true);
    expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("0px");
  });
  expect(tears).toEqual([]);
});

test("swipeDirection and swipeThreshold: a controlled drawer swiped out to the right", async () => {
  const { getByTestId } = mount(right);
  const popup = getByTestId("popup") as HTMLDialogElement;
  expect(popup.open).toBe(true);
  expect(popup.getAttribute("data-swipe-direction")).toBe("right");
  let release = slowDrag(popup, [
    [10, 10],
    [40, 10],
  ]);
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-x")).toBe("30px");
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("0px");
  expect(popup.style.getPropertyValue("--drawer-swipe-progress")).toBe("0.1");
  release([40, 10]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(getByTestId("open").textContent).toBe("open");
  release = slowDrag(popup, [
    [10, 10],
    [70, 10],
  ]);
  release([70, 10]);
  // The owner hears of it in a change of its own, a microtask later.
  await expect.poll(() => getByTestId("open").textContent).toBe("closed");
  await closed(popup);
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
  const release = slowDrag(handle, [
    [50, 10],
    [50, 30],
  ]);
  expect(touchMove()).toBe(true);
  release([50, 30]);
  expect(touchMove()).toBe(false);
});

test("a close the browser would do itself waits for the owner, and slides out once it agrees", async () => {
  const { getByRole, getByTestId, user } = mount(nativeClose);
  await user.click(getByRole("button", { name: "Open drawer" }));
  const popup = getByTestId("popup") as HTMLDialogElement;
  for (const name of ["Apply", "Dismiss"]) {
    // oxlint-disable-next-line no-await-in-loop -- each press acts on the drawer the one before left open
    await user.click(getByRole("button", { name }));
    // oxlint-disable-next-line no-await-in-loop
    await frame();
    expect(popup.open).toBe(true);
  }
  expect(getByTestId("requests").textContent).toBe("3");

  await user.click(getByRole("button", { name: "Unlock" }));
  for (const name of ["Apply", "Dismiss"]) {
    // oxlint-disable-next-line no-await-in-loop -- one close after the other
    if (!popup.open) await user.click(getByRole("button", { name: "Open drawer" }));
    // oxlint-disable-next-line no-await-in-loop
    await user.click(getByRole("button", { name }));
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => popup.hasAttribute("data-ending-style")).toBe(true);
    expect(popup.open).toBe(true);
    // oxlint-disable-next-line no-await-in-loop
    await closed(popup);
  }
});
