import { fireEvent } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { flush, mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";
import hover from "./fixtures/hover.rx";
import modal from "./fixtures/modal.rx";

afterEach(() => {
  vi.useRealTimers();
});

/** Fake timers for the hover delays; animation frames stay real so a closed popup can unmount. */
function useHoverTimers() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

function advance(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

test("is closed until the trigger is pressed, then wires ARIA", async () => {
  const { getByRole, queryByRole, getByText, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Notifications" });
  expect(queryByRole("dialog")).toBeNull();
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(trigger.hasAttribute("aria-controls")).toBe(false);

  await user.click(trigger);
  const popup = getByRole("dialog");
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.getAttribute("aria-controls")).toBe(popup.id);
  expect(trigger.hasAttribute("data-popup-open")).toBe(true);
  expect(popup.getAttribute("aria-labelledby")).toBe(getByText("Notifications", { selector: "h2" }).id);
  expect(popup.getAttribute("aria-describedby")).toBe(getByText("You are all caught up.").id);
  expect(popup.hasAttribute("aria-modal")).toBe(false);
  expect(popup.hasAttribute("data-open")).toBe(true);
  expect(getByTestId("positioner").style.position).toBe("absolute");
  await expect.poll(() => popup.getAttribute("data-side")).toBe("bottom");
  expect(popup.getAttribute("data-align")).toBe("center");
  const arrow = getByTestId("arrow");
  expect(arrow.getAttribute("aria-hidden")).toBe("true");
  expect(arrow.getAttribute("data-side")).toBe("bottom");
  expect(arrow.hasAttribute("data-open")).toBe(true);
  expect(getByTestId("changes").textContent).toBe("1");
  // Non-modal: the page keeps scrolling.
  expect(document.documentElement.style.overflow).toBe("");
});

test("pressing the trigger again closes it", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Notifications" });
  await user.click(trigger);
  await user.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  await expect.poll(() => queryByRole("dialog")).toBeNull();
  expect(getByTestId("changes").textContent).toBe("2");
});

test("moves focus in on open and back to the trigger on Escape", async () => {
  const { getByRole, queryByRole, user } = mount(basic);
  const trigger = getByRole("button", { name: "Notifications" });
  await user.click(trigger);
  expect(document.activeElement).toBe(getByRole("button", { name: "Settings" }));
  await user.keyboard("{Escape}");
  await expect.poll(() => queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test("closes on a press outside without stealing focus back", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Notifications" }));
  const after = getByRole("button", { name: "After" });
  await user.click(after);
  await expect.poll(() => queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(after);
  // Dismissal and focus leaving both ask to close: the consumer hears it once.
  expect(getByTestId("changes").textContent).toBe("2");
});

test("PopoverClose closes it", async () => {
  const { getByRole, queryByRole, user } = mount(basic);
  const trigger = getByRole("button", { name: "Notifications" });
  await user.click(trigger);
  await user.click(getByRole("button", { name: "Dismiss" }));
  await expect.poll(() => queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test("non-modal: Tab past the end goes to what follows the trigger and closes", async () => {
  const { getByRole, queryByRole, user } = mount(basic);
  await user.click(getByRole("button", { name: "Notifications" }));
  await user.tab();
  expect(document.activeElement).toBe(getByRole("button", { name: "Dismiss" }));
  await user.tab();
  expect(document.activeElement).toBe(getByRole("button", { name: "After" }));
  await expect.poll(() => queryByRole("dialog")).toBeNull();
});

test("non-modal: Shift+Tab from the start goes back to the trigger and closes", async () => {
  const { getByRole, queryByRole, user } = mount(basic);
  const trigger = getByRole("button", { name: "Notifications" });
  await user.click(trigger);
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(trigger);
  await expect.poll(() => queryByRole("dialog")).toBeNull();
});

test("modal: traps focus and locks page scroll", async () => {
  const { getByRole, queryByRole, user } = mount(modal);
  const trigger = getByRole("button", { name: "Edit name" });
  await user.click(trigger);
  const name = getByRole("textbox", { name: "Name" });
  const done = getByRole("button", { name: "Done" });
  expect(document.activeElement).toBe(name);
  expect(document.documentElement.style.overflow).toBe("hidden");
  await user.tab();
  expect(document.activeElement).toBe(done);
  await user.tab();
  expect(document.activeElement).toBe(name);
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(done);
  expect(getByRole("dialog")).toBeTruthy();

  await user.click(done);
  await expect.poll(() => queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(document.documentElement.style.overflow).toBe("");
});

test('modal="trap-focus" traps focus without locking scroll', async () => {
  const { getByRole, user } = mount(modal);
  await user.click(getByRole("button", { name: "Trap only" }));
  expect(document.activeElement).toBe(getByRole("button", { name: "Inside" }));
  expect(document.documentElement.style.overflow).toBe("");
  await user.tab();
  await user.tab();
  expect(document.activeElement).toBe(getByRole("button", { name: "Inside" }));
});

test("modal without a PopoverClose doesn't trap focus", async () => {
  const { getByRole, queryByRole, user } = mount(modal);
  await user.click(getByRole("button", { name: "No close part" }));
  expect(document.activeElement).toBe(getByRole("button", { name: "Lonely" }));
  await user.tab();
  expect(document.activeElement).toBe(getByRole("button", { name: "Elsewhere" }));
  await expect.poll(() => queryByRole("dialog")).toBeNull();
});

test("can be controlled, and reports the requested side", async () => {
  const { getByRole, queryByTestId, getByTestId, user } = mount(controlled);
  const popup = getByTestId("popup");
  expect(getByRole("button", { name: "Filters" }).getAttribute("aria-expanded")).toBe("true");
  await expect.poll(() => popup.getAttribute("data-side")).toBe("right");
  expect(popup.getAttribute("data-align")).toBe("start");

  await user.click(getByRole("button", { name: "Filters" }));
  expect(getByTestId("open").textContent).toBe("closed");
  await expect.poll(() => queryByTestId("popup")).toBeNull();
  await user.click(getByRole("button", { name: "Toggle from outside" }));
  expect(getByTestId("popup")).toBeTruthy();
});

test("openOnHover: opens after the delay without moving focus, closes after the close delay", async () => {
  const user = useHoverTimers();
  const { getByRole, queryByRole, getByTestId } = mount(hover);
  const trigger = getByRole("button", { name: "Profile" });

  await user.hover(trigger);
  advance(199);
  expect(queryByRole("dialog")).toBeNull();
  advance(1);
  expect(getByRole("dialog")).toBeTruthy();
  expect(document.activeElement).toBe(document.body);

  await user.unhover(trigger);
  advance(99);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  advance(1);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(getByTestId("changes").textContent).toBe("2");
});

test("openOnHover: leaving before the delay never opens it", async () => {
  const user = useHoverTimers();
  const { getByRole, queryByRole, getByTestId } = mount(hover);
  const trigger = getByRole("button", { name: "Profile" });
  await user.hover(trigger);
  advance(100);
  await user.unhover(trigger);
  advance(500);
  expect(queryByRole("dialog")).toBeNull();
  expect(getByTestId("changes").textContent).toBe("0");
});

test("openOnHover: the pointer can move onto the popup and stay", async () => {
  const user = useHoverTimers();
  const { getByRole, getByTestId } = mount(hover);
  const trigger = getByRole("button", { name: "Profile" });
  await user.hover(trigger);
  advance(200);
  await user.hover(getByTestId("popup"));
  advance(1000);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");

  await user.hover(getByTestId("outside"));
  advance(100);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("openOnHover: a click makes a hover-open stick", async () => {
  const user = useHoverTimers();
  const { getByRole } = mount(hover);
  const trigger = getByRole("button", { name: "Profile" });
  await user.hover(trigger);
  advance(200);
  await user.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  await user.unhover(trigger);
  advance(1000);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  // Now it behaves as click-opened: the next press closes it.
  await user.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("openOnHover ignores touch pointers", async () => {
  useHoverTimers();
  const { getByRole, queryByRole } = mount(hover);
  const trigger = getByRole("button", { name: "Profile" });
  fireEvent.pointerEnter(trigger, { pointerType: "touch" });
  advance(1000);
  expect(queryByRole("dialog")).toBeNull();
  fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
  advance(200);
  expect(queryByRole("dialog")).toBeTruthy();
});
