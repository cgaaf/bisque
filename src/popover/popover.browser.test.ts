import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";
import hover from "./fixtures/hover.rx";

const shown = (popup: HTMLElement) => popup.matches(":popover-open");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The real pointer stays where the last test left it: start a hover test away from every trigger. */
async function startHover() {
  const mounted = mount(hover);
  await mounted.user.hover(mounted.getByTestId("outside"));
  return mounted;
}

test("is closed until the trigger is pressed, then wires ARIA", async () => {
  const { getByRole, getByText, user } = mount(basic);
  const trigger = getByRole("button", { name: "Notifications" });
  const popup = getByText("Inbox").parentElement!;
  expect(shown(popup)).toBe(false);
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(trigger.getAttribute("aria-controls")).toBe(popup.id);

  await user.click(trigger);
  expect(shown(popup)).toBe(true);
  await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("true");
  expect(popup.getAttribute("role")).toBe("dialog");
  expect(popup.getAttribute("aria-labelledby")).toBe(getByText("Inbox").id);
  expect(popup.getAttribute("aria-describedby")).toBe(getByText("You're all caught up.").id);
});

test("pressing the trigger again closes it", async () => {
  const { getByRole, getByText, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Notifications" });
  const popup = getByText("Inbox").parentElement!;
  await user.click(trigger);
  await user.click(trigger);
  expect(shown(popup)).toBe(false);
  await expect.poll(() => getByTestId("changes").textContent).toBe("2");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("the browser places it against the trigger: below, left edges aligned, 8px away", async () => {
  const { getByRole, getByText, user } = mount(basic);
  const trigger = getByRole("button", { name: "Notifications" });
  await user.click(trigger);
  await frame();
  const anchor = trigger.getBoundingClientRect();
  const placed = getByText("Inbox").parentElement!.getBoundingClientRect();
  expect(Math.round(placed.top - anchor.bottom)).toBe(8);
  expect(Math.round(placed.left - anchor.left)).toBe(0);
});

test("the browser flips it above the trigger when it can't fit below", async () => {
  const { getByRole, getByText, user } = mount(controlled);
  const trigger = getByRole("button", { name: "Low" });
  await user.click(trigger);
  await frame();
  const placed = getByText("Up here").getBoundingClientRect();
  expect(placed.bottom).toBeLessThanOrEqual(trigger.getBoundingClientRect().top + 1);
  expect(placed.top).toBeGreaterThanOrEqual(0);
});

test("closes on Escape and on a press outside, and reports both", async () => {
  const { getByRole, getByText, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Notifications" });
  const popup = getByText("Inbox").parentElement!;
  await user.click(trigger);
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
  await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("false");

  await user.click(trigger);
  expect(shown(popup)).toBe(true);
  // A point of the page the popup doesn't cover.
  await user.click(document.body, { position: { x: 5, y: 5 } });
  expect(shown(popup)).toBe(false);
  await expect.poll(() => getByTestId("changes").textContent).toBe("4");
});

test("Tab moves from the trigger into the popup, and Escape returns focus to the trigger", async () => {
  const { getByRole, getByText, user } = mount(basic);
  const trigger = getByRole("button", { name: "Notifications" });
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(trigger);
  // The popup follows its trigger in the Tab order, wherever it is in the document. Which element inside it
  // takes focus first is the engine's call: Firefox stops on the popup itself (a popover is a scroll container),
  // and Safari skips buttons unless the system setting says otherwise.
  await user.tab();
  expect(getByText("Inbox").parentElement!.contains(document.activeElement)).toBe(true);
  await user.keyboard("{Escape}");
  expect(document.activeElement).toBe(trigger);
});

test("PopoverClose closes it", async () => {
  const { getByRole, getByText, user } = mount(basic);
  await user.click(getByRole("button", { name: "Notifications" }));
  await user.click(getByRole("button", { name: "Done" }));
  await expect.poll(() => shown(getByText("Inbox").parentElement!)).toBe(false);
});

test("can be controlled from outside its parts", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  const popup = getByTestId("settings");
  expect(popup.getAttribute("aria-label")).toBe("Settings panel");
  await user.click(getByRole("button", { name: "Open from outside" }));
  await expect.poll(() => shown(popup)).toBe(true);
  expect(getByTestId("open").textContent).toBe("open");
  await user.keyboard("{Escape}");
  await expect.poll(() => getByTestId("open").textContent).toBe("closed");
  expect(shown(popup)).toBe(false);
});

test("without openOnHover, resting the pointer on the trigger does nothing", async () => {
  const { getByRole, getByText, user } = mount(basic);
  await user.hover(getByRole("button", { name: "Notifications" }));
  await sleep(500);
  expect(shown(getByText("Inbox").parentElement!)).toBe(false);
});

test("openOnHover: opens after the default 300ms and closes when the pointer leaves", async () => {
  const { getByRole, getByTestId, user } = await startHover();
  const trigger = getByRole("button", { name: "Account" });
  const popup = getByTestId("account");
  await user.hover(trigger);
  await sleep(150);
  expect(shown(popup)).toBe(false);
  await expect.poll(() => shown(popup), { timeout: 600 }).toBe(true);
  await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("true");
  // Still a light-dismiss popover, anchored to its trigger.
  expect(popup.getAttribute("popover")).toBe("auto");
  await frame();
  expect(Math.round(popup.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom)).toBe(8);

  await user.hover(getByTestId("outside"));
  await expect.poll(() => shown(popup)).toBe(false);
  await expect.poll(() => getByTestId("changes").textContent).toBe("2");
});

test("openOnHover: the pointer can move onto the popup; leaving the popup closes it", async () => {
  const { getByRole, getByTestId, user } = await startHover();
  const popup = getByTestId("account");
  await user.hover(getByRole("button", { name: "Account" }));
  await expect.poll(() => shown(popup), { timeout: 800 }).toBe(true);
  await frame();
  await user.hover(popup);
  await sleep(200);
  expect(shown(popup)).toBe(true);
  await user.hover(getByTestId("outside"));
  await expect.poll(() => shown(popup)).toBe(false);
});

test("openOnHover: a press while hover has it open keeps it open, and then leaving doesn't close it", async () => {
  const { getByRole, getByTestId, user } = await startHover();
  const trigger = getByRole("button", { name: "Account" });
  const popup = getByTestId("account");
  await user.hover(trigger);
  await expect.poll(() => shown(popup), { timeout: 800 }).toBe(true);
  await user.click(trigger);
  await sleep(100);
  expect(shown(popup)).toBe(true);
  await user.hover(getByTestId("outside"));
  await sleep(200);
  expect(shown(popup)).toBe(true);
  // Now it is an ordinary popover: the trigger toggles it.
  await user.click(trigger);
  await expect.poll(() => shown(popup)).toBe(false);
  expect(getByTestId("changes").textContent).toBe("2");
});

test("openOnHover: a popover opened by a press before the delay stays open when the pointer leaves", async () => {
  const { getByRole, getByTestId, user } = await startHover();
  const trigger = getByRole("button", { name: "Account" });
  const popup = getByTestId("account");
  await user.click(trigger);
  expect(shown(popup)).toBe(true);
  await sleep(400);
  await user.hover(getByTestId("outside"));
  await sleep(200);
  expect(shown(popup)).toBe(true);
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
});

test("openOnHover: the trigger's own delay and closeDelay", async () => {
  const { getByRole, getByTestId, user } = await startHover();
  const popup = getByTestId("help");
  await user.hover(getByRole("button", { name: "Help" }));
  await expect.poll(() => shown(popup), { timeout: 250 }).toBe(true);
  await user.hover(getByTestId("outside"));
  await sleep(100);
  expect(shown(popup)).toBe(true);
  await expect.poll(() => shown(popup), { timeout: 800 }).toBe(false);
});

test("openOnHover: Escape closes a popover hover opened", async () => {
  const { getByRole, getByTestId, user } = await startHover();
  const trigger = getByRole("button", { name: "Account" });
  const popup = getByTestId("account");
  await user.hover(trigger);
  await expect.poll(() => shown(popup), { timeout: 800 }).toBe(true);
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
  await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("false");
});
