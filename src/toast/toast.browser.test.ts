import { afterEach, expect, test, vi } from "vitest";
import { page, server } from "vitest/browser";
import { within } from "@testing-library/dom";
import { flush, frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import swipe from "./fixtures/swipe.rx";
import demo from "./fixtures/demo.rx";
import twoProviders from "./fixtures/two-providers.rx";
import overDialog from "./fixtures/over-dialog.rx";
// @ts-expect-error a plain JS fixture module, typed for .rx by its .d.rx only
import { appToasts } from "./fixtures/app-toasts.js";

/** Fake timers for the delays (Date too: a paused timer keeps its remaining time); animation frames stay real. */
function fakeTimers() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
}

function advance(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

afterEach(() => {
  vi.useRealTimers();
  appToasts.close();
});

const toasts = () => [...document.querySelectorAll<HTMLElement>("[data-rs-ui-toast]")];
const open = () => toasts().filter((el) => !el.hasAttribute("data-ending-style"));

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
) {
  const box = from.getBoundingClientRect();
  const x = box.left + start.x;
  const y = box.top + start.y;
  if (server.browser !== "firefox") {
    // The drop target is the root element: the end point must land on the target, and every point is inside it.
    await user.dragAndDrop(
      from as never,
      document.documentElement as never,
      { sourcePosition: start, targetPosition: { x: x + by.x, y: y + by.y }, steps: 10 } as never,
    );
    return;
  }
  firePointer("pointerdown", x, y);
  for (let step = 1; step <= 10; step += 1)
    firePointer("pointermove", x + (by.x * step) / 10, y + (by.y * step) / 10);
  firePointer("pointerup", x + by.x, y + by.y);
  await frame();
}

/** Resolves once `el` has left the document (a closing toast, after its exit animation). */
const gone = (el: Element | null | undefined) => expect.poll(() => el?.isConnected ?? false).toBe(false);

test("the viewport is a manual popover, shown and empty before the first toast", () => {
  const { getByTestId } = mount(basic);
  const viewport = getByTestId("viewport");
  expect(viewport.getAttribute("popover")).toBe("manual");
  expect(viewport.matches(":popover-open")).toBe(true);
  expect(viewport.getAttribute("role")).toBe("region");
  expect(viewport.getAttribute("aria-live")).toBe("polite");
  expect(viewport.getAttribute("aria-label")).toBe("Notifications");
  expect(toasts()).toHaveLength(0);
});

test("adds a toast from inside the tree, labelled by its title and description", async () => {
  const { getByRole, getByTestId, getByText, user } = mount(basic);
  await user.click(getByRole("button", { name: "Add" }));
  const root = getByRole("dialog");
  expect(getByTestId("viewport").contains(root)).toBe(true);
  expect(root.getAttribute("aria-modal")).toBe("false");
  expect(root.getAttribute("tabindex")).toBe("0");
  expect(root.getAttribute("aria-labelledby")).toBe(getByText("Toast 1").id);
  expect(root.getAttribute("aria-describedby")).toBe(getByText("Body 1").id);
  expect(root.style.getPropertyValue("--toast-index")).toBe("0");
  expect(root.hasAttribute("data-starting-style")).toBe(false);
});

test("adds, updates and closes a toast from code outside the tree", async () => {
  const { getByText, queryByText } = mount(basic);
  const id = appToasts.add({ title: "From a module", timeout: 0 });
  flush();
  expect(getByText("From a module")).toBeTruthy();

  appToasts.update(id, { title: "Updated", type: "success" });
  flush();
  expect(queryByText("From a module")).toBeNull();
  const root = getByText("Updated").closest<HTMLElement>("[data-rs-ui-toast]");
  expect(root?.getAttribute("data-type")).toBe("success");

  appToasts.close(id);
  flush();
  expect(root?.hasAttribute("data-ending-style")).toBe(true);
  await gone(root);
});

test("keeps the same root element across updates", () => {
  mount(basic);
  const id = appToasts.add({ title: "One", timeout: 0 });
  flush();
  const root = toasts()[0];
  root.dataset.marker = "kept";
  appToasts.update(id, { description: "More" });
  appToasts.add({ title: "Two", timeout: 0 });
  flush();
  expect(toasts()).toHaveLength(2);
  expect(toasts()[1]).toBe(root);
  expect(root.dataset.marker).toBe("kept");
  expect(root.textContent).toContain("More");
});

test("a closing toast stays, with data-ending-style, until its exit animation has finished", async () => {
  mount(basic);
  appToasts.add({ title: "Leaving", timeout: 0 });
  flush();
  const root = toasts()[0];
  root.style.transition = "opacity 150ms linear";
  root.style.opacity = "1";
  appToasts.close();
  flush();
  root.style.opacity = "0";
  await frame();
  await frame();
  expect(root.isConnected).toBe(true);
  expect(root.hasAttribute("data-ending-style")).toBe(true);
  await gone(root);
});

test("closes by itself after its timeout, measured from when it appeared", async () => {
  fakeTimers();
  const { getByRole } = mount(basic);
  getByRole("button", { name: "Add" }).click();
  flush();
  const root = getByRole("dialog");
  advance(999);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  advance(1);
  expect(root.hasAttribute("data-ending-style")).toBe(true);
  vi.useRealTimers();
  await gone(root);
});

test("a timeout of 0 and a loading toast never close by themselves", () => {
  fakeTimers();
  mount(basic);
  appToasts.add({ title: "Sticky", timeout: 0 });
  appToasts.add({ title: "Working", type: "loading" });
  flush();
  advance(60_000);
  expect(open()).toHaveLength(2);
});

test("hovering the viewport pauses the timers and leaving resumes them with the time left", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const viewport = getByTestId("viewport");
  fakeTimers();
  appToasts.add({ title: "Hover me" });
  flush();
  const root = toasts()[0];
  advance(600);
  // The faked clock moves on while a real `user` call is in flight, by as long as the call takes (more on a
  // busy machine), and the timer runs for some of that before the pointer arrives. Measure it.
  let drift = -Date.now();
  await user.hover(root);
  drift += Date.now();
  expect(viewport.hasAttribute("data-expanded")).toBe(true);
  expect(root.hasAttribute("data-expanded")).toBe(true);
  advance(5000);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  drift -= Date.now();
  await user.hover(getByRole("button", { name: "Before" }));
  drift += Date.now();
  expect(viewport.hasAttribute("data-expanded")).toBe(false);
  // 400ms were left when it paused, less whatever ran during the two hovers.
  const atLeast = 400 - drift - 10;
  if (atLeast > 0) {
    advance(atLeast);
    expect(root.hasAttribute("data-ending-style")).toBe(false);
  }
  advance(400 - Math.max(atLeast, 0));
  expect(root.hasAttribute("data-ending-style")).toBe(true);
});

test("pauses while the window doesn't have focus", () => {
  fakeTimers();
  mount(basic);
  appToasts.add({ title: "Away" });
  flush();
  const root = toasts()[0];
  window.dispatchEvent(new FocusEvent("blur"));
  flush();
  advance(5000);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  window.dispatchEvent(new FocusEvent("focus"));
  flush();
  advance(1000);
  expect(root.hasAttribute("data-ending-style")).toBe(true);
});

test("an update restarts the timer only when it changes the timeout or ends loading", () => {
  fakeTimers();
  mount(basic);
  const id = appToasts.add({ title: "Saving", type: "loading" });
  flush();
  advance(5000);
  appToasts.update(id, { title: "Saved", type: "success" });
  flush();
  advance(600);
  appToasts.update(id, { description: "All good" });
  flush();
  advance(399);
  expect(open()).toHaveLength(1);
  advance(1);
  expect(open()).toHaveLength(0);
});

test("adding the same id again updates the toast in place and restarts its timer", () => {
  fakeTimers();
  mount(basic);
  appToasts.add({ id: "sync", title: "Syncing" });
  flush();
  advance(800);
  appToasts.add({ id: "sync", title: "Synced" });
  flush();
  expect(toasts()).toHaveLength(1);
  expect(toasts()[0].textContent).toContain("Synced");
  advance(800);
  expect(open()).toHaveLength(1);
  advance(200);
  expect(open()).toHaveLength(0);
});

test("a promise toast shows loading, then success or error", async () => {
  const { getByText } = mount(basic);
  const { promise: pending, resolve } = Promise.withResolvers<string>();
  const result = appToasts.promise(pending, {
    loading: "Saving…",
    success: (value: string) => ({ title: "Saved", description: value }),
    error: "Failed",
  });
  flush();
  const root = getByText("Saving…").closest<HTMLElement>("[data-rs-ui-toast]");
  expect(root?.getAttribute("data-type")).toBe("loading");
  resolve("report.pdf");
  await expect(result).resolves.toBe("report.pdf");
  flush();
  expect(root?.getAttribute("data-type")).toBe("success");
  expect(root?.textContent).toContain("report.pdf");

  const failing = appToasts.promise(Promise.reject(new Error("nope")), {
    loading: "Trying",
    success: "Done",
    error: "Failed",
  });
  await expect(failing).rejects.toThrow("nope");
  flush();
  expect(getByText("Failed").closest("[data-rs-ui-toast]")?.getAttribute("data-type")).toBe("error");
});

test("beyond the limit, older toasts stay in the list but are limited and inert", async () => {
  const { getByRole, user } = mount(basic);
  const add = getByRole("button", { name: "Add" });
  await user.click(add);
  await user.click(add);
  await user.click(add);
  const [newest, middle, oldest] = toasts();
  expect(newest.textContent).toContain("Toast 3");
  expect(oldest.textContent).toContain("Toast 1");
  expect(oldest.hasAttribute("data-limited")).toBe(true);
  expect(oldest.inert).toBe(true);
  expect(middle.hasAttribute("data-limited")).toBe(false);
  expect(newest.style.getPropertyValue("--toast-index")).toBe("0");
  expect(middle.style.getPropertyValue("--toast-index")).toBe("1");
  expect(oldest.style.getPropertyValue("--toast-index")).toBe("2");

  // Closing one in front lets the limited one back in.
  newest.querySelector<HTMLElement>("button")!.click();
  flush();
  expect(oldest.hasAttribute("data-limited")).toBe(false);
  expect(oldest.inert).toBe(false);
  expect(oldest.style.getPropertyValue("--toast-index")).toBe("1");
});

test("the close button and Escape close it; onClose then onRemove are called", async () => {
  const { getByRole, getByText, user } = mount(basic);
  const calls: string[] = [];
  appToasts.add({
    title: "Callbacks",
    timeout: 0,
    onClose: () => calls.push("close"),
    onRemove: () => calls.push("remove"),
  });
  flush();
  // Out of the accessibility tree while the stack is collapsed, so found by its text.
  const close = getByText("Dismiss");
  expect(close.getAttribute("aria-hidden")).toBe("true");
  const callbacks = close.closest("[data-rs-ui-toast]");
  close.click();
  flush();
  expect(calls).toEqual(["close"]);
  await gone(callbacks);
  expect(calls).toEqual(["close", "remove"]);

  await user.click(getByRole("button", { name: "Add" }));
  const root = getByRole("dialog");
  root.focus();
  await user.keyboard("{Escape}");
  expect(root.hasAttribute("data-ending-style")).toBe(true);
});

test("an action button takes the toast's actionProps", async () => {
  const { getByRole, user } = mount(basic);
  let undone = 0;
  appToasts.add({
    title: "Deleted",
    timeout: 0,
    actionProps: { children: "Undo", onClick: () => (undone += 1) },
  });
  appToasts.add({ title: "No action", timeout: 0 });
  flush();
  expect(document.querySelectorAll("[data-rs-ui-toast] button:not([aria-hidden])")).toHaveLength(1);
  await user.click(getByRole("button", { name: "Undo" }));
  expect(undone).toBe(1);
});

test("a high-priority toast is an alertdialog announced through a separate alert in the viewport", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Add urgent" }));
  const root = toasts()[0];
  expect(root.getAttribute("role")).toBe("alertdialog");
  expect(root.getAttribute("aria-hidden")).toBe("true");
  const alert = getByRole("alert");
  expect(alert.textContent).toContain("Fixed");
  // In the viewport's top layer, but not inside the toast that assistive technology is told to skip.
  expect(getByTestId("viewport").contains(alert)).toBe(true);
  expect(root.contains(alert)).toBe(false);
});

test("F6 moves focus to the viewport, and F6 again returns it", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const add = getByRole("button", { name: "Add" });
  add.focus();
  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(add);
  await user.keyboard("{F6}");
  const viewport = getByTestId("viewport");
  expect(document.activeElement).toBe(viewport);
  await user.tab();
  expect(document.activeElement).toBe(getByRole("dialog"));
  expect(viewport.hasAttribute("data-expanded")).toBe(true);
  await user.keyboard("{F6}");
  expect(document.activeElement).toBe(add);
  expect(viewport.hasAttribute("data-expanded")).toBe(false);
});

test("keyboard focus in the viewport pauses the timers until it leaves", async () => {
  const { getByRole, user } = mount(basic);
  const add = getByRole("button", { name: "Add" });
  fakeTimers();
  add.focus();
  await user.keyboard("{Enter}");
  const root = getByRole("dialog");
  await user.keyboard("{F6}");
  await user.tab();
  expect(document.activeElement).toBe(root);
  advance(5000);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  await user.keyboard("{F6}");
  expect(document.activeElement).toBe(add);
  // As above: the real key presses may have moved the faked clock on a little while the timer ran.
  advance(1000);
  expect(root.hasAttribute("data-ending-style")).toBe(true);
});

test("F6 does nothing while there are no toasts", async () => {
  const { getByRole, user } = mount(basic);
  const before = getByRole("button", { name: "Before" });
  before.focus();
  await user.keyboard("{F6}");
  expect(document.activeElement).toBe(before);
});

test("closing a focused toast hands focus to the next one", async () => {
  const { getByRole, user } = mount(basic);
  const add = getByRole("button", { name: "Add" });
  await user.click(add);
  await user.click(add);
  const [newest, older] = toasts();
  newest.focus();
  await user.keyboard("{Escape}");
  expect(document.activeElement).toBe(older);
});

test("heights and offsets are measured and exposed as CSS variables", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const add = getByRole("button", { name: "Add" });
  await user.click(add);
  await user.click(add);
  const [newest, older] = toasts();
  await expect.poll(() => newest.style.getPropertyValue("--toast-height")).toBe(`${newest.offsetHeight}px`);
  expect(newest.offsetHeight).toBeGreaterThan(0);
  expect(newest.style.getPropertyValue("--toast-offset-y")).toBe("0px");
  expect(older.style.getPropertyValue("--toast-offset-y")).toBe(`${newest.offsetHeight}px`);
  expect(getByTestId("viewport").style.getPropertyValue("--toast-frontmost-height")).toBe(
    `${newest.offsetHeight}px`,
  );
});

test("a mouse drag right past the threshold dismisses it in that direction", async () => {
  const { user } = mount(basic);
  appToasts.add({ title: "Swipe me", timeout: 0 });
  flush();
  const root = toasts()[0];
  const title = root.querySelector("h2")!;
  await mouseDrag(user, title, { x: 5, y: 5 }, { x: 50, y: 1 });
  expect(root.hasAttribute("data-swiping")).toBe(false);
  expect(root.hasAttribute("data-ending-style")).toBe(true);
  expect(root.getAttribute("data-swipe-direction")).toBe("right");
  expect(root.style.getPropertyValue("--toast-swipe-movement-x")).toBe("50px");
});

test("a mouse drag short of the threshold snaps back", async () => {
  const { user } = mount(basic);
  appToasts.add({ title: "Stay", timeout: 0 });
  flush();
  const root = toasts()[0];
  const title = root.querySelector("h2")!;
  await mouseDrag(user, title, { x: 5, y: 2 }, { x: 0, y: 30 });
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  expect(root.hasAttribute("data-swiping")).toBe(false);
  expect(root.hasAttribute("data-swipe-direction")).toBe(false);
  expect(root.style.getPropertyValue("--toast-swipe-movement-y")).toBe("0px");
});

test("a mouse drag that starts on a button inside the toast doesn't swipe", async () => {
  const { user } = mount(basic);
  appToasts.add({ title: "Buttons", timeout: 0 });
  flush();
  const root = toasts()[0];
  const button = root.querySelector("button")!;
  await mouseDrag(user, button, { x: 2, y: 2 }, { x: 150, y: 0 });
  expect(root.hasAttribute("data-ending-style")).toBe(false);
});

test("movement against the swipe directions is damped and never dismisses", () => {
  mount(basic);
  appToasts.add({ title: "Not that way", timeout: 0 });
  flush();
  const root = toasts()[0];
  const box = root.getBoundingClientRect();
  const at = (type: string, y: number) => {
    root.dispatchEvent(
      new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, clientX: box.left + 5, clientY: y }),
    );
    flush();
  };
  at("pointerdown", box.top + 5);
  at("pointermove", box.top - 95);
  expect(root.style.getPropertyValue("--toast-swipe-movement-y")).toBe("-10px");
  at("pointerup", box.top - 95);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
});

test("swipeDirection and swipeThreshold choose where and how far", async () => {
  const { user } = mount(swipe);
  appToasts.add({ title: "Up only" });
  flush();
  const root = toasts()[0];
  const title = root.querySelector("h2")!;
  // 60px up: under the threshold of 80.
  await mouseDrag(user, title, { x: 5, y: 5 }, { x: 0, y: -60 });
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  await mouseDrag(user, title, { x: 5, y: 5 }, { x: 0, y: -100 });
  expect(root.hasAttribute("data-ending-style")).toBe(true);
  expect(root.getAttribute("data-swipe-direction")).toBe("up");
});

test("timers stop while a toast is being swiped", () => {
  fakeTimers();
  mount(basic);
  appToasts.add({ title: "Held" });
  flush();
  const root = toasts()[0];
  const box = root.getBoundingClientRect();
  const at = (type: string, y: number) => {
    root.dispatchEvent(
      new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, clientX: box.left + 5, clientY: y }),
    );
    flush();
  };
  at("pointerdown", box.top + 5);
  at("pointermove", box.top + 15);
  advance(5000);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  at("pointerup", box.top + 15);
  advance(1000);
  expect(root.hasAttribute("data-ending-style")).toBe(true);
});

test("the demo adds toasts from its buttons", async () => {
  const { getByRole, getByText, user } = mount(demo);
  await user.click(getByRole("button", { name: "Save draft" }));
  await user.click(getByRole("button", { name: "Delete message" }));
  expect(getByText("Draft 1 was saved.")).toBeTruthy();
  expect(getByRole("button", { name: "Undo" })).toBeTruthy();
  await user.click(getByRole("button", { name: "Fail upload" }));
  expect(getByRole("alert").textContent).toContain("Upload failed");
});

test("each provider keeps its own list and its own viewport", async () => {
  const { getByRole, user } = mount(twoProviders);
  await user.click(getByRole("button", { name: "Add to Left" }));
  await user.click(getByRole("button", { name: "Add to Left" }));
  await user.click(getByRole("button", { name: "Add to Right" }));
  const left = getByRole("region", { name: "Left" });
  const right = getByRole("region", { name: "Right" });
  expect(left.matches(":popover-open")).toBe(true);
  expect(right.matches(":popover-open")).toBe(true);
  expect(left.querySelectorAll("[data-rs-ui-toast]")).toHaveLength(2);
  expect(right.querySelectorAll("[data-rs-ui-toast]")).toHaveLength(1);
});

/** The colour the page shows at a point, from a screenshot: what is painted on top there. */
async function colourAt(x: number, y: number): Promise<string> {
  const shot = (await page.screenshot({ save: false, base64: true } as never)) as unknown;
  const base64 = typeof shot === "string" ? shot : (shot as { base64: string }).base64;
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d")!;
  context.drawImage(image, 0, 0);
  const scale = image.width / window.innerWidth;
  const [r, g, b] = context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
  return `${r},${g},${b}`;
}

test("toasts are painted above a modal dialog opened after them, but are inert under it", async () => {
  const { getByRole, getByTestId, user } = mount(overDialog);
  const viewport = getByTestId("viewport");
  await user.click(getByRole("button", { name: "Add toast" }));
  const trigger = getByRole("button", { name: "Open dialog" });
  trigger.focus();
  await user.keyboard("{Enter}");
  const dialog = getByRole("dialog", { name: "Modal" }) as HTMLDialogElement;
  expect(dialog.matches(":modal")).toBe(true);
  await frame();
  await frame();
  const box = viewport.getBoundingClientRect();
  const x = box.left + box.width - 4;
  const y = box.top + box.height - 4;
  // Red: the viewport, not the dialog's blue backdrop.
  await expect.poll(() => colourAt(x, y)).toBe("255,0,0");
  // Everything outside a modal dialog is inert: hit testing passes through the toast to the backdrop.
  expect(document.elementFromPoint(x, y)).toBe(dialog);

  // A toast added from inside the dialog lands in the same viewport, still on top.
  await user.click(within(dialog).getByRole("button", { name: "Add toast" }));
  expect(toasts()).toHaveLength(2);
  expect(await colourAt(x, y)).toBe("255,0,0");
});
