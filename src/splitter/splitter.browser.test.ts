// The splitter in Chromium, Firefox and WebKit (fixtures/basic.rx): sizes as laid out, the keys, pointer drags,
// controlled sizes, collapsing, panels added after mount, nesting, disabled and right to left. Drags are dispatched
// pointer events, as in the slider's tests (Firefox's real drags flake beside other files).
import { expect, test } from "vitest";
import { server } from "vitest/browser";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";

function firePointer(target: Element | Document, type: string, x: number, y: number) {
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
      clientX: x,
      clientY: y,
    }),
  );
}

function center(element: Element) {
  const box = element.getBoundingClientRect();
  return [box.left + box.width / 2, box.top + box.height / 2] as const;
}

/** Drags `handle` by (dx, dy) pixels in `steps` moves, waiting a frame after each. */
async function drag(handle: HTMLElement, dx: number, dy: number, steps = 2, release = true) {
  const [x, y] = center(handle);
  firePointer(handle, "pointerdown", x, y);
  await frame();
  for (let i = 1; i <= steps; i += 1) {
    firePointer(document, "pointermove", x + (dx * i) / steps, y + (dy * i) / steps);
    // oxlint-disable-next-line no-await-in-loop -- each move is seen before the next
    await frame();
  }
  if (release) {
    firePointer(document, "pointerup", x + dx, y + dy);
    await frame();
  }
}

const width = (element: HTMLElement) => element.getBoundingClientRect().width;
const height = (element: HTMLElement) => element.getBoundingClientRect().height;
const near = (actual: number, expected: number, within = 1) =>
  expect(Math.abs(actual - expected)).toBeLessThan(within);

test("the panels start at their default sizes on the first frame, and the handle describes the panel before it", async () => {
  const { getByRole, getByTestId } = mount(basic);
  await frame();
  // 408px less an 8px handle: 40% is 160px.
  near(width(getByTestId("two-left")), 160);
  near(width(getByTestId("two-right")), 240);
  const handle = getByRole("separator", { name: "Two" });
  expect(handle.getAttribute("aria-valuenow")).toBe("40");
  expect(handle.getAttribute("aria-valuemin")).toBe("0");
  expect(handle.getAttribute("aria-valuemax")).toBe("100");
  expect(handle.getAttribute("aria-orientation")).toBe("vertical");
  expect(handle.getAttribute("data-orientation")).toBe("horizontal");
  expect(handle.getAttribute("tabindex")).toBe("0");
  expect(handle.getAttribute("aria-controls")).toBe(getByTestId("two-left").id);
  expect(getByTestId("two").getAttribute("data-orientation")).toBe("horizontal");
  expect(getByTestId("two-left").getAttribute("data-orientation")).toBe("horizontal");
  // A stacked group's handle is a horizontal bar.
  expect(getByRole("separator", { name: "Inner" }).getAttribute("aria-orientation")).toBe("horizontal");
});

test("the arrow keys on the group's axis move the handle; the other arrows do nothing", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await frame();
  const handle = getByRole("separator", { name: "Two" });
  handle.focus();
  await user.keyboard("{ArrowRight}");
  expect(handle.getAttribute("aria-valuenow")).toBe("50");
  await frame();
  near(width(getByTestId("two-left")), 200);
  await user.keyboard("{ArrowLeft}{ArrowLeft}");
  expect(handle.getAttribute("aria-valuenow")).toBe("30");
  await user.keyboard("{ArrowUp}{ArrowDown}");
  expect(handle.getAttribute("aria-valuenow")).toBe("30");
  // Each key is a change and a commit.
  expect(getByTestId("commits").textContent).toBe("3");
  expect(getByTestId("changes").textContent).toBe("3");

  const inner = getByRole("separator", { name: "Inner" });
  inner.focus();
  await user.keyboard("{ArrowDown}");
  expect(inner.getAttribute("aria-valuenow")).toBe("60");
  await user.keyboard("{ArrowLeft}{ArrowRight}");
  expect(inner.getAttribute("aria-valuenow")).toBe("60");
  await user.keyboard("{ArrowUp}{ArrowUp}");
  expect(inner.getAttribute("aria-valuenow")).toBe("40");
  await frame();
  near(height(getByTestId("inner-top")), (200 - 8) * 0.4);
});

test("Home and End move the handle as far as the panels' bounds allow", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await frame();
  const second = getByRole("separator", { name: "Second" });
  // The value is main's size: at least its minimum (30), at most what nav (20) and aside's minimum (10) leave.
  expect(second.getAttribute("aria-valuenow")).toBe("50");
  expect(second.getAttribute("aria-valuemin")).toBe("30");
  expect(second.getAttribute("aria-valuemax")).toBe("70");
  second.focus();
  await user.keyboard("{Home}");
  expect(second.getAttribute("aria-valuenow")).toBe("30");
  await user.keyboard("{End}");
  // main grows into aside until aside's minimum (10).
  expect(second.getAttribute("aria-valuenow")).toBe("70");
  await frame();
  near(width(getByTestId("aside")), 40);
  // Home and End land exactly on what the handle announces as its minimum and maximum.
  expect(second.getAttribute("aria-valuemax")).toBe("70");
  await user.keyboard("{Home}");
  expect(second.getAttribute("aria-valuenow")).toBe(second.getAttribute("aria-valuemin"));
  // nav is collapsible: its smallest allowed size is its collapsed size (5), and Home collapses it (APG).
  const first = getByRole("separator", { name: "First" });
  expect(first.getAttribute("aria-valuemin")).toBe("5");
  first.focus();
  await user.keyboard("{End}");
  expect(first.getAttribute("aria-valuenow")).toBe("40");
  expect(first.getAttribute("aria-valuenow")).toBe(first.getAttribute("aria-valuemax"));
  await user.keyboard("{Home}");
  expect(first.getAttribute("aria-valuenow")).toBe("5");
  expect(first.getAttribute("aria-valuenow")).toBe(first.getAttribute("aria-valuemin"));
  expect(getByTestId("nav").hasAttribute("data-collapsed")).toBe(true);
  await expect.poll(() => getByTestId("collapses").textContent).toBe("1");
  // Enter restores the size it had before Home collapsed it.
  await user.keyboard("{Enter}");
  expect(first.getAttribute("aria-valuenow")).toBe("40");
});

test("Enter collapses a collapsible panel and restores its previous size, calling onCollapse and onExpand", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await frame();
  const first = getByRole("separator", { name: "First" });
  const nav = getByTestId("nav");
  expect(nav.hasAttribute("data-collapsed")).toBe(false);
  expect(first.getAttribute("aria-valuemin")).toBe("5");
  first.focus();
  await user.keyboard("{ArrowRight}");
  expect(first.getAttribute("aria-valuenow")).toBe("25");
  await user.keyboard("{Enter}");
  expect(first.getAttribute("aria-valuenow")).toBe("5");
  expect(nav.hasAttribute("data-collapsed")).toBe(true);
  await expect.poll(() => getByTestId("collapses").textContent).toBe("1");
  expect(getByTestId("expands").textContent).toBe("0");
  await user.keyboard("{Enter}");
  expect(first.getAttribute("aria-valuenow")).toBe("25");
  expect(nav.hasAttribute("data-collapsed")).toBe(false);
  await expect.poll(() => getByTestId("expands").textContent).toBe("1");
  // An arrow at the minimum collapses it too.
  await user.keyboard("{ArrowLeft}{ArrowLeft}");
  expect(first.getAttribute("aria-valuenow")).toBe("15");
  await user.keyboard("{ArrowLeft}");
  expect(first.getAttribute("aria-valuenow")).toBe("5");
  await expect.poll(() => getByTestId("collapses").textContent).toBe("2");
  await user.keyboard("{ArrowRight}");
  expect(first.getAttribute("aria-valuenow")).toBe("15");
  // A handle with no collapsible panel beside it ignores Enter.
  const two = getByRole("separator", { name: "Two" });
  two.focus();
  await user.keyboard("{Enter}");
  expect(two.getAttribute("aria-valuenow")).toBe("40");
});

test("a panel that starts collapsed doesn't call onCollapse on mount, and calls onExpand when it opens", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await frame();
  await frame();
  const handle = getByRole("separator", { name: "Starts collapsed" });
  expect(getByTestId("starts-collapsed").hasAttribute("data-collapsed")).toBe(true);
  expect(handle.getAttribute("aria-valuenow")).toBe("0");
  expect(getByTestId("mount-collapses").textContent).toBe("0");
  handle.focus();
  await user.keyboard("{Enter}");
  expect(handle.getAttribute("aria-valuenow")).toBe("25");
  await expect.poll(() => getByTestId("mount-expands").textContent).toBe("1");
  expect(getByTestId("mount-collapses").textContent).toBe("0");
});

test("a drag moves the handle, marks the root and the handle while it lasts, and commits once on release", async () => {
  const { getByRole, getByTestId } = mount(basic);
  await frame();
  const handle = getByRole("separator", { name: "Two" });
  const root = getByTestId("two");
  await drag(handle, 40, 0, 4, false);
  expect(root.hasAttribute("data-dragging")).toBe(true);
  expect(handle.hasAttribute("data-dragging")).toBe(true);
  expect(getByRole("separator", { name: "Controlled" }).hasAttribute("data-dragging")).toBe(false);
  near(width(getByTestId("two-left")), 200);
  expect(handle.getAttribute("aria-valuenow")).toBe("50");
  expect(getByTestId("commits").textContent).toBe("0");
  await expect.poll(() => Number(getByTestId("changes").textContent)).toBeGreaterThan(1);
  const [x, y] = center(handle);
  firePointer(document, "pointerup", x, y);
  await frame();
  expect(root.hasAttribute("data-dragging")).toBe(false);
  expect(handle.hasAttribute("data-dragging")).toBe(false);
  await expect.poll(() => getByTestId("commits").textContent).toBe("1");
  // The press focuses the handle.
  expect(document.activeElement).toBe(handle);
});

test("a drag stops at the bounds, takes from the nearest panels that can still shrink, and comes back", async () => {
  const { getByRole, getByTestId } = mount(basic);
  await frame();
  const first = getByRole("separator", { name: "First" });
  // nav is at most 40%.
  await drag(first, 200, 0);
  expect(first.getAttribute("aria-valuenow")).toBe("40");
  // nav 40, main 30 (its minimum), aside 30. The second handle far left: main can't shrink, so nav gives up
  // space, down to its minimum.
  const second = getByRole("separator", { name: "Second" });
  const [x, y] = center(second);
  firePointer(second, "pointerdown", x, y);
  await frame();
  firePointer(document, "pointermove", x - 300, y);
  await frame();
  expect(getByRole("separator", { name: "First" }).getAttribute("aria-valuenow")).toBe("15");
  expect(second.getAttribute("aria-valuenow")).toBe("30");
  // Back to where the press was: every panel returns.
  firePointer(document, "pointermove", x, y);
  await frame();
  expect(first.getAttribute("aria-valuenow")).toBe("40");
  expect(second.getAttribute("aria-valuenow")).toBe("30");
  firePointer(document, "pointerup", x, y);
  await frame();
  near(width(getByTestId("nav")) + width(getByTestId("main")) + width(getByTestId("aside")), 400, 3);
});

test("a drag past halfway below a collapsible panel's minimum collapses it", async () => {
  const { getByRole, getByTestId } = mount(basic);
  await frame();
  const first = getByRole("separator", { name: "First" });
  const available = width(getByTestId("nav")) + width(getByTestId("main")) + width(getByTestId("aside"));
  // From 20% to 11%: below halfway between 15 and 5.
  await drag(first, -0.11 * available, 0);
  expect(first.getAttribute("aria-valuenow")).toBe("5");
  expect(getByTestId("nav").hasAttribute("data-collapsed")).toBe(true);
  await expect.poll(() => getByTestId("collapses").textContent).toBe("1");
});

test("controlled sizes follow the owner, from the keys, a drag and its own writes", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await frame();
  const handle = getByRole("separator", { name: "Controlled" });
  expect(handle.getAttribute("aria-valuenow")).toBe("30");
  handle.focus();
  await user.keyboard("{ArrowRight}");
  expect(getByTestId("controlled-sizes").textContent).toBe("40,60");
  expect(handle.getAttribute("aria-valuenow")).toBe("40");
  await user.click(getByRole("button", { name: "Set 60/40" }));
  expect(handle.getAttribute("aria-valuenow")).toBe("60");
  await drag(handle, -40, 0);
  expect(handle.getAttribute("aria-valuenow")).toBe("50");
  expect(getByTestId("controlled-sizes").textContent).toBe(
    // 40px of the 400px the panels share less the handle's own width (none here).
    "50,50",
  );
});

test("controlled by commits only: the handle follows a drag, then shows what the owner committed", async () => {
  const { getByRole, getByTestId } = mount(basic);
  await frame();
  const handle = getByRole("separator", { name: "Commit only" });
  await drag(handle, 40, 0, 2, false);
  expect(handle.getAttribute("aria-valuenow")).toBe("40");
  // The owner hasn't written anything yet.
  expect(getByTestId("commit-only-sizes").textContent).toBe("30,70");
  const [x, y] = center(handle);
  firePointer(document, "pointerup", x, y);
  await frame();
  await expect.poll(() => getByTestId("commit-only-sizes").textContent).toBe("40,60");
  expect(handle.getAttribute("aria-valuenow")).toBe("40");
});

test("controlled with no handler: a key moves the handle, which goes back to the owner's sizes", async () => {
  const { getByRole, user } = mount(basic);
  await frame();
  const handle = getByRole("separator", { name: "Fixed" });
  handle.focus();
  await user.keyboard("{ArrowRight}");
  await expect.poll(() => handle.getAttribute("aria-valuenow")).toBe("30");
  await drag(handle, 40, 0);
  await expect.poll(() => handle.getAttribute("aria-valuenow")).toBe("30");
});

// Real pointer input (capture, the prevented press and the handle taking focus, a real release) in Chromium and
// WebKit. Firefox's real drags disturb the files running beside it (see the drawer's tests), so the dispatched
// drags above stand for it there.
test.skipIf(server.browser === "firefox")(
  "a real mouse drag moves the handle and commits on release",
  async () => {
    const { getByRole, getByTestId, user } = mount(basic);
    await frame();
    const handle = getByRole("separator", { name: "Two" });
    const root = getByTestId("two");
    const box = handle.getBoundingClientRect();
    const rootBox = root.getBoundingClientRect();
    await user.dragAndDrop(handle, root, {
      sourcePosition: { x: box.width / 2, y: box.height / 2 },
      targetPosition: { x: box.left + box.width / 2 + 40 - rootBox.left, y: box.height / 2 },
      steps: 10,
    } as never);
    await frame();
    expect(handle.getAttribute("aria-valuenow")).toBe("50");
    expect(root.hasAttribute("data-dragging")).toBe(false);
    await expect.poll(() => getByTestId("commits").textContent).toBe("1");
    expect(document.activeElement).toBe(handle);
  },
);

test("a panel added after mount takes its default size and the others keep their proportions; removing it gives the space back", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await frame();
  const first = getByRole("separator", { name: "First" });
  first.focus();
  await user.keyboard("{ArrowRight}");
  // nav 25, main 45, aside 30.
  await user.click(getByRole("button", { name: "Toggle extra" }));
  await expect.poll(() => getByRole("separator", { name: "Third" }).getAttribute("aria-valuenow")).toBe("24");
  // The others share 80% in proportion: 20, 36, 24; extra takes 20.
  expect(first.getAttribute("aria-valuenow")).toBe("20");
  expect(getByRole("separator", { name: "Second" }).getAttribute("aria-valuenow")).toBe("36");
  await frame();
  // Three 8px handles leave 392px.
  near(width(getByTestId("extra")), 392 * 0.2, 2);
  await user.click(getByRole("button", { name: "Toggle extra" }));
  await expect
    .poll(() => getByRole("separator", { name: "Second" }).getAttribute("aria-valuenow"))
    .toBe("45");
  expect(first.getAttribute("aria-valuenow")).toBe("25");
});

test("a nested splitter keeps to itself: its handles, its drag and its ids", async () => {
  const { getByRole, getByTestId } = mount(basic);
  await frame();
  const outer = getByRole("separator", { name: "Outer" });
  const inner = getByRole("separator", { name: "Inner" });
  expect(outer.getAttribute("aria-controls")).toBe(getByTestId("outer-left").id);
  expect(inner.getAttribute("aria-controls")).toBe(getByTestId("inner-top").id);
  // Both splitters have a panel called "left": their ids still differ.
  expect(getByTestId("outer-left").id).not.toBe(getByTestId("two-left").id);
  await drag(inner, 0, 48);
  expect(inner.getAttribute("aria-valuenow")).toBe("75");
  expect(outer.getAttribute("aria-valuenow")).toBe("50");
  expect(getByTestId("outer").hasAttribute("data-dragging")).toBe(false);
  await drag(outer, 40, 0);
  expect(outer.getAttribute("aria-valuenow")).toBe("60");
  expect(inner.getAttribute("aria-valuenow")).toBe("75");
});

test("a disabled group or handle takes no keys or drags and leaves the tab order", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await frame();
  for (const name of ["Disabled group", "Disabled handle"]) {
    const handle = getByRole("separator", { name });
    expect(handle.hasAttribute("tabindex")).toBe(false);
    expect(handle.getAttribute("aria-disabled")).toBe("true");
    expect(handle.hasAttribute("data-disabled")).toBe(true);
    // Made focusable here only to show the keys are ignored too.
    handle.tabIndex = 0;
    handle.focus();
    expect(document.activeElement).toBe(handle);
    // oxlint-disable-next-line no-await-in-loop -- one handle at a time
    await user.keyboard("{ArrowRight}");
    // oxlint-disable-next-line no-await-in-loop
    await drag(handle, 40, 0);
    expect(handle.getAttribute("aria-valuenow")).toBe("50");
  }
  expect(getByTestId("disabled").hasAttribute("data-disabled")).toBe(true);
});

test("right to left mirrors the horizontal arrows and the drag", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await frame();
  const handle = getByRole("separator", { name: "RTL" });
  const start = getByTestId("rtl-start");
  // The first panel is on the right.
  expect(start.getBoundingClientRect().left).toBeGreaterThan(handle.getBoundingClientRect().left);
  handle.focus();
  await user.keyboard("{ArrowLeft}");
  expect(handle.getAttribute("aria-valuenow")).toBe("60");
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(handle.getAttribute("aria-valuenow")).toBe("40");
  // Dragging left grows the first panel.
  await drag(handle, -40, 0);
  expect(handle.getAttribute("aria-valuenow")).toBe("50");
});

test("a double-click on a handle puts the default sizes back", async () => {
  const { getByRole, user } = mount(basic);
  await frame();
  const handle = getByRole("separator", { name: "Second" });
  handle.focus();
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(handle.getAttribute("aria-valuenow")).toBe("60");
  await user.dblClick(handle);
  expect(handle.getAttribute("aria-valuenow")).toBe("50");
});

// The platform's own resizing, for the docs' claim: CSS `resize` puts a grip on one element's corner. It isn't a
// separator, isn't a Tab stop of its own, and the keys don't resize it.
test("CSS resize gives no keyboard path and no separator", async () => {
  const { container, user, queryAllByRole } = mount(basic);
  const before = queryAllByRole("separator").length;
  const box = document.createElement("div");
  box.style.cssText = "resize: horizontal; overflow: hidden; width: 100px; height: 40px";
  box.textContent = "Resizable";
  const input = document.createElement("input");
  container.prepend(input, box);
  expect(getComputedStyle(box).resize).toBe("horizontal");
  expect(queryAllByRole("separator")).toHaveLength(before);
  input.focus();
  await user.keyboard("{Tab}");
  expect(document.activeElement).not.toBe(box);
  box.tabIndex = 0;
  box.focus();
  await user.keyboard("{ArrowRight}{ArrowLeft}{End}");
  expect(width(box)).toBe(100);
});
