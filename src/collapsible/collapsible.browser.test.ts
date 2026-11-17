import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";

const details = (el: HTMLElement) => el as HTMLDetailsElement;
const summary = (getByText: (text: string) => HTMLElement, text: string) =>
  getByText(text).closest("summary")!;

test("is a closed <details> whose content the browser hides", () => {
  const { getByTestId } = mount(basic);
  const root = details(getByTestId("uncontrolled"));
  const panel = getByTestId("panel");
  expect(root.tagName).toBe("DETAILS");
  expect(root.open).toBe(false);
  expect(root.className).toBe("mine");
  expect(panel.parentElement).toBe(root);
  expect(panel.checkVisibility()).toBe(false);
  // No mirrored state attributes: `[open]` is the hook.
  expect(root.hasAttribute("data-open")).toBe(false);
  expect(root.hasAttribute("data-closed")).toBe(false);
});

test("the summary opens it and closes it again", async () => {
  const { getByTestId, getByText, user } = mount(basic);
  const root = details(getByTestId("uncontrolled"));
  const trigger = summary(getByText, "Toggle");
  await user.click(trigger);
  expect(root.open).toBe(true);
  expect(getByTestId("panel").checkVisibility()).toBe(true);
  await user.click(trigger);
  await expect.poll(() => root.open).toBe(false);
  expect(getByTestId("changes").textContent).toBe("open,close");
  // The consumer's handler ran beside the part's.
  expect(getByTestId("clicks").textContent).toBe("2");
});

test("Enter and Space on the summary toggle it", async () => {
  const { getByTestId, getByText, user } = mount(basic);
  const root = details(getByTestId("uncontrolled"));
  summary(getByText, "Toggle").focus();
  await user.keyboard("{Enter}");
  expect(root.open).toBe(true);
  await user.keyboard(" ");
  await expect.poll(() => root.open).toBe(false);
  expect(getByTestId("changes").textContent).toBe("open,close");
});

test("stays open with data-ending-style until the panel's exit transition ends", async () => {
  const { getByTestId, getByText, user } = mount(basic);
  const root = details(getByTestId("uncontrolled"));
  const panel = getByTestId("panel");
  const trigger = summary(getByText, "Toggle");
  await user.click(trigger);
  await expect.poll(() => panel.style.getPropertyValue("--collapsible-panel-height")).toBe("auto");
  await user.click(trigger);
  expect(panel.hasAttribute("data-ending-style")).toBe(true);
  expect(root.open).toBe(true);
  await frame();
  await frame();
  const height = panel.getBoundingClientRect().height;
  expect(height).toBeGreaterThan(0);
  expect(height).toBeLessThan(120);
  await expect.poll(() => root.open).toBe(false);
  expect(panel.hasAttribute("data-ending-style")).toBe(false);
});

test("pressing the trigger during the exit opens it again", async () => {
  const { getByTestId, getByText, user } = mount(basic);
  const root = details(getByTestId("uncontrolled"));
  const panel = getByTestId("panel");
  const trigger = summary(getByText, "Toggle");
  await user.click(trigger);
  await user.click(trigger);
  expect(panel.hasAttribute("data-ending-style")).toBe(true);
  await user.click(trigger);
  expect(panel.hasAttribute("data-ending-style")).toBe(false);
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(root.open).toBe(true);
  expect(getByTestId("changes").textContent).toBe("open,close,open");
});

test("animates its height in from 0 to the measured size", async () => {
  const { getByTestId, getByText, user } = mount(basic);
  const panel = getByTestId("panel");
  // Measured while closed, so the open transition has a length to run to.
  expect(panel.style.getPropertyValue("--collapsible-panel-height")).toBe("120px");
  expect(panel.style.getPropertyValue("--collapsible-panel-width")).toBe(`${panel.scrollWidth}px`);
  await user.click(summary(getByText, "Toggle"));
  await frame();
  await frame();
  const height = panel.getBoundingClientRect().height;
  expect(height).toBeGreaterThan(0);
  expect(height).toBeLessThan(120);
  // Once it is open the size is `auto`, so the content can grow.
  await expect.poll(() => panel.style.getPropertyValue("--collapsible-panel-height")).toBe("auto");
  expect(panel.getBoundingClientRect().height).toBe(120);
});

test("a controlled disclosure follows its owner, not the summary", async () => {
  const { getByRole, getByTestId, getByText, user } = mount(basic);
  const root = details(getByTestId("controlled"));
  await user.click(summary(getByText, "Controlled"));
  await frame();
  expect(root.open).toBe(false);
  expect(getByTestId("requests").textContent).toBe("1");

  await user.click(getByRole("button", { name: "Flip" }));
  expect(root.open).toBe(true);
  await user.click(getByRole("button", { name: "Flip" }));
  await expect.poll(() => root.open).toBe(false);
});

test("an open the browser makes by itself is reported, and undone when the owner refuses it", async () => {
  const { getByTestId } = mount(basic);
  // What find-in-page does: the browser sets `open` on the element.
  const root = details(getByTestId("uncontrolled"));
  root.open = true;
  await expect.poll(() => getByTestId("changes").textContent).toBe("open");
  expect(root.open).toBe(true);

  const controlled = details(getByTestId("controlled"));
  controlled.open = true;
  await expect.poll(() => getByTestId("requests").textContent).toBe("1");
  await expect.poll(() => controlled.open).toBe(false);
});

test("trigger props work on a summary the consumer writes, with a heading inside", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  const root = details(getByTestId("own-root"));
  expect(root.open).toBe(true);
  expect(getByRole("heading", { name: "Own heading" }).tagName).toBe("H3");
  await user.click(getByRole("heading", { name: "Own heading" }));
  await expect.poll(() => root.open).toBe(false);
  expect(getByTestId("own-panel").checkVisibility()).toBe(false);
});

test("does nothing while disabled, and is out of the tab order", async () => {
  const { getByTestId, getByText, user } = mount(basic);
  const root = details(getByTestId("disabled"));
  const trigger = summary(getByText, "Disabled");
  expect(trigger.getAttribute("aria-disabled")).toBe("true");
  expect(trigger.tabIndex).toBe(-1);
  expect(root.hasAttribute("data-disabled")).toBe(true);
  await user.click(trigger);
  trigger.focus();
  await user.keyboard("{Enter}");
  await user.keyboard(" ");
  await frame();
  expect(root.open).toBe(false);
});

test("toggling quickly rebuilds no part's props needlessly", async () => {
  const { getByTestId, getByText } = mount(basic);
  // Each open and close rebuilds the context; props built straight from it would come out new but equal every
  // time, which Solid reports (UNSTABLE_MEMO_OUTPUT) and the setup turns into a failure.
  const trigger = summary(getByText, "Toggle");
  for (let i = 0; i < 8; i++) {
    trigger.click();
    // oxlint-disable-next-line no-await-in-loop -- each press lands while the one before is still animating
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  // An even number of presses leaves it closed.
  await expect.poll(() => details(getByTestId("uncontrolled")).open).toBe(false);
});
