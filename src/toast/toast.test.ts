import { afterEach, expect, test, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { flush, mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import swipe from "./fixtures/swipe.rx";
import demo from "./fixtures/demo.rx";
import twoProviders from "./fixtures/two-providers.rx";
// @ts-expect-error a plain JS fixture module, typed for .rx by its .d.rx only
import { appToasts } from "./fixtures/app-toasts.js";

/** Fake timers for the delays (Date too: a paused timer keeps its remaining time); animation frames stay real. */
function setup() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

function advance(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

afterEach(() => {
  vi.useRealTimers();
});

/** The height the tests give a toast. */
const h = (el: HTMLElement) => 40 + el.textContent!.length;

const toasts = () => [...document.querySelectorAll<HTMLElement>("[data-rs-ui-toast]")];
const open = () => toasts().filter((el) => !el.hasAttribute("data-ending-style"));

test("adds a toast from inside the tree, labelled by its title and description", async () => {
  const { getByRole, getByTestId, getByText, user } = mount(basic);
  const viewport = getByTestId("viewport");
  expect(viewport.getAttribute("role")).toBe("region");
  expect(viewport.getAttribute("aria-live")).toBe("polite");
  expect(viewport.getAttribute("aria-label")).toBe("Notifications");
  expect(toasts()).toHaveLength(0);

  await user.click(getByRole("button", { name: "Add" }));
  const root = getByRole("dialog");
  expect(viewport.contains(root)).toBe(true);
  expect(root.getAttribute("aria-modal")).toBe("false");
  expect(root.getAttribute("tabindex")).toBe("0");
  expect(root.getAttribute("aria-labelledby")).toBe(getByText("Toast 1").id);
  expect(root.getAttribute("aria-describedby")).toBe(getByText("Body 1").id);
  expect(root.style.getPropertyValue("--toast-index")).toBe("0");
});

test("adds, updates and closes a toast from code outside the tree", async () => {
  const { getByText, queryByText } = mount(basic);
  let id = "";
  id = appToasts.add({ title: "From a module", timeout: 0 });
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
  await expect.poll(() => queryByText("Updated")).toBeNull();
});

test("keeps the same root element across updates", async () => {
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

test("closes by itself after its timeout, measured from when it appeared", async () => {
  const user = setup();
  const { getByRole, queryByRole } = mount(basic);
  await user.click(getByRole("button", { name: "Add" }));
  const root = getByRole("dialog");
  advance(999);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  advance(1);
  expect(root.hasAttribute("data-ending-style")).toBe(true);
  await vi.waitFor(() => expect(queryByRole("dialog")).toBeNull());
});

test("a timeout of 0 and a loading toast never close by themselves", () => {
  setup();
  mount(basic);
  appToasts.add({ title: "Sticky", timeout: 0 });
  appToasts.add({ title: "Working", type: "loading" });
  flush();
  advance(60_000);
  expect(open()).toHaveLength(2);
});

test("hovering the viewport pauses the timers and leaving resumes them with the time left", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  await user.click(getByRole("button", { name: "Add" }));
  const root = getByRole("dialog");
  const viewport = getByTestId("viewport");
  advance(600);
  await user.hover(viewport);
  expect(viewport.hasAttribute("data-expanded")).toBe(true);
  expect(root.hasAttribute("data-expanded")).toBe(true);
  advance(5000);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  await user.unhover(viewport);
  expect(viewport.hasAttribute("data-expanded")).toBe(false);
  advance(399);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  advance(1);
  expect(root.hasAttribute("data-ending-style")).toBe(true);
});

test("pauses while the window doesn't have focus", async () => {
  const user = setup();
  const { getByRole } = mount(basic);
  await user.click(getByRole("button", { name: "Add" }));
  const root = getByRole("dialog");
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
  setup();
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
  setup();
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
  setup();
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
  expect(root?.textContent).toContain("Saved");
  expect(root?.textContent).toContain("report.pdf");

  const failing = appToasts.promise(Promise.reject(new Error("nope")), {
    loading: "Trying",
    success: "Done",
    error: "Failed",
  });
  await expect(failing).rejects.toThrow("nope");
  flush();
  const failed = getByText("Failed").closest<HTMLElement>("[data-rs-ui-toast]");
  expect(failed?.getAttribute("data-type")).toBe("error");
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
  expect(oldest.hasAttribute("inert")).toBe(true);
  expect(middle.hasAttribute("data-limited")).toBe(false);
  expect(newest.style.getPropertyValue("--toast-index")).toBe("0");
  expect(middle.style.getPropertyValue("--toast-index")).toBe("1");
  expect(oldest.style.getPropertyValue("--toast-index")).toBe("2");

  // Closing one in front lets the limited one back in.
  await user.click(newest.querySelector("button")!);
  expect(oldest.hasAttribute("data-limited")).toBe(false);
  expect(oldest.hasAttribute("inert")).toBe(false);
  expect(oldest.style.getPropertyValue("--toast-index")).toBe("1");
});

test("the close button and Escape close it; onClose then onRemove are called", async () => {
  const { getByRole, getByText, queryByText, user } = mount(basic);
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
  await user.click(close);
  expect(calls).toEqual(["close"]);
  await expect.poll(() => queryByText("Callbacks")).toBeNull();
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

test("a high-priority toast is an alertdialog announced through a separate alert", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Add urgent" }));
  const root = toasts()[0];
  expect(root.getAttribute("role")).toBe("alertdialog");
  expect(root.getAttribute("aria-hidden")).toBe("true");
  const alert = getByRole("alert");
  expect(alert.textContent).toContain("Fixed");
  expect(getByTestId("viewport").contains(alert)).toBe(false);
});

test("F6 moves focus to the viewport, and F6 again returns it", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const add = getByRole("button", { name: "Add" });
  await user.click(add);
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
  const user = setup();
  const { getByRole } = mount(basic);
  const add = getByRole("button", { name: "Add" });
  await user.click(add);
  const root = getByRole("dialog");
  await user.keyboard("{F6}");
  await user.tab();
  expect(document.activeElement).toBe(root);
  advance(5000);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  await user.keyboard("{F6}");
  expect(document.activeElement).toBe(add);
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

test("a new toast has data-starting-style for its first frame", async () => {
  mount(basic);
  // Checked synchronously: the attribute goes on the next animation frame.
  appToasts.add({ title: "Fresh", timeout: 0 });
  flush();
  const root = toasts()[0];
  expect(root.hasAttribute("data-starting-style")).toBe(true);
  await expect.poll(() => root.hasAttribute("data-starting-style")).toBe(false);
});

test("heights and offsets are exposed as CSS variables", async () => {
  const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.hasAttribute("data-rs-ui-toast") ? h(this) : 0;
  });
  try {
    const { getByRole, getByTestId, user } = mount(basic);
    const add = getByRole("button", { name: "Add" });
    await user.click(add);
    await user.click(add);
    const [newest, older] = toasts();
    expect(newest.style.getPropertyValue("--toast-height")).toBe(`${h(newest)}px`);
    expect(newest.style.getPropertyValue("--toast-offset-y")).toBe("0px");
    expect(older.style.getPropertyValue("--toast-offset-y")).toBe(`${h(newest)}px`);
    expect(getByTestId("viewport").style.getPropertyValue("--toast-frontmost-height")).toBe(`${h(newest)}px`);
  } finally {
    height.mockRestore();
  }
});

function pointer(target: Element, type: string, x: number, y: number) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      button: 0,
      clientX: x,
      clientY: y,
    }),
  );
  flush();
}

function drag(target: Element, path: [number, number][]) {
  const [first, ...rest] = path;
  pointer(target, "pointerdown", ...first);
  for (const point of rest) pointer(target, "pointermove", ...point);
}

test("swiping right past the threshold dismisses it in that direction", () => {
  mount(basic);
  appToasts.add({ title: "Swipe me", timeout: 0 });
  flush();
  const root = toasts()[0];
  const title = root.querySelector("h2")!;
  drag(title, [
    [100, 100],
    [110, 101],
    [130, 101],
  ]);
  expect(root.hasAttribute("data-swiping")).toBe(true);
  expect(root.getAttribute("data-swipe-direction")).toBe("right");
  expect(root.style.getPropertyValue("--toast-swipe-movement-x")).toBe("30px");
  pointer(title, "pointermove", 145, 101);
  pointer(title, "pointerup", 145, 101);
  expect(root.hasAttribute("data-swiping")).toBe(false);
  expect(root.hasAttribute("data-ending-style")).toBe(true);
  expect(root.getAttribute("data-swipe-direction")).toBe("right");
  expect(root.style.getPropertyValue("--toast-swipe-movement-x")).toBe("45px");
});

test("a swipe short of the threshold snaps back", () => {
  mount(basic);
  appToasts.add({ title: "Stay", timeout: 0 });
  flush();
  const root = toasts()[0];
  drag(root, [
    [100, 100],
    [100, 120],
    [100, 135],
  ]);
  expect(root.getAttribute("data-swipe-direction")).toBe("down");
  expect(root.style.getPropertyValue("--toast-swipe-movement-y")).toBe("35px");
  pointer(root, "pointerup", 100, 135);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  expect(root.hasAttribute("data-swiping")).toBe(false);
  expect(root.hasAttribute("data-swipe-direction")).toBe(false);
  expect(root.style.getPropertyValue("--toast-swipe-movement-y")).toBe("0px");
});

test("moving back from a swipe calls it off", () => {
  mount(basic);
  appToasts.add({ title: "Changed my mind", timeout: 0 });
  flush();
  const root = toasts()[0];
  drag(root, [
    [100, 100],
    [100, 130],
    [100, 150],
    [100, 141],
    [100, 139],
  ]);
  pointer(root, "pointerup", 100, 139);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
});

test("movement against the swipe directions is damped and never dismisses", () => {
  mount(basic);
  appToasts.add({ title: "Not that way", timeout: 0 });
  flush();
  const root = toasts()[0];
  drag(root, [
    [100, 100],
    [100, 0],
  ]);
  expect(root.style.getPropertyValue("--toast-swipe-movement-y")).toBe("-10px");
  pointer(root, "pointerup", 100, 0);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
});

test("a press on a button inside the toast doesn't start a swipe", () => {
  mount(basic);
  appToasts.add({ title: "Buttons", timeout: 0 });
  flush();
  const root = toasts()[0];
  const button = root.querySelector("button")!;
  drag(button, [
    [100, 100],
    [200, 100],
  ]);
  expect(root.hasAttribute("data-swiping")).toBe(false);
  pointer(button, "pointerup", 200, 100);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
});

test("swipeDirection and swipeThreshold choose where and how far", async () => {
  const { unmount } = mount(swipe);
  appToasts.add({ title: "Up only" });
  flush();
  const root = toasts()[0];
  drag(root, [
    [100, 100],
    [100, 30],
  ]);
  pointer(root, "pointerup", 100, 30);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  drag(root, [
    [100, 100],
    [100, 10],
  ]);
  pointer(root, "pointerup", 100, 10);
  expect(root.hasAttribute("data-ending-style")).toBe(true);
  expect(root.getAttribute("data-swipe-direction")).toBe("up");
  unmount();
});

test("timers stop while a toast is being swiped", () => {
  setup();
  mount(basic);
  appToasts.add({ title: "Held" });
  flush();
  const root = toasts()[0];
  drag(root, [
    [100, 100],
    [100, 110],
  ]);
  advance(5000);
  expect(root.hasAttribute("data-ending-style")).toBe(false);
  pointer(root, "pointerup", 100, 110);
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

test("each provider keeps its own list", async () => {
  const { getByRole, user } = mount(twoProviders);
  await user.click(getByRole("button", { name: "Add to Left" }));
  await user.click(getByRole("button", { name: "Add to Left" }));
  await user.click(getByRole("button", { name: "Add to Right" }));
  const left = getByRole("region", { name: "Left" });
  const right = getByRole("region", { name: "Right" });
  expect(left.querySelectorAll("[data-rs-ui-toast]")).toHaveLength(2);
  expect(right.querySelectorAll("[data-rs-ui-toast]")).toHaveLength(1);
});
