import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

test("opens and closes when the trigger is pressed", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Toggle" });
  const root = getByTestId("uncontrolled");

  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(trigger.hasAttribute("aria-controls")).toBe(false);
  expect(root.hasAttribute("data-closed")).toBe(true);
  expect(queryByTestId("panel")).toBeNull();

  await user.click(trigger);
  const panel = getByTestId("panel");
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.getAttribute("aria-controls")).toBe(panel.id);
  expect(root.hasAttribute("data-open")).toBe(true);
  expect(panel.textContent).toBe("Content");

  await user.click(trigger);
  // It stays mounted for the exit animation (none in jsdom), then goes.
  await expect.poll(() => queryByTestId("panel")).toBeNull();
});

test("keeps the consumer's class and handler beside its own", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  expect(getByTestId("uncontrolled").className).toBe("mine");
  await user.click(getByRole("button", { name: "Toggle" }));
  expect(getByTestId("changes").textContent).toBe("1");
  expect(getByTestId("panel")).toBeTruthy();
});

test("trigger props work on an element the consumer owns", async () => {
  const { getByTestId, queryByTestId, user } = mount(basic);
  const link = getByTestId("link");
  expect(link.tagName).toBe("A");
  expect(link.hasAttribute("type")).toBe(false);
  await user.click(link);
  expect(link.getAttribute("aria-expanded")).toBe("true");
  expect(queryByTestId("panel")).not.toBeNull();
});

test("follows a controlled `open` and reports changes", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const kept = getByTestId("kept");
  expect(kept.hidden).toBe(true);
  await user.click(getByRole("button", { name: "Controlled" }));
  expect(kept.hidden).toBe(false);
  expect(getByTestId("controlled").hasAttribute("data-open")).toBe(true);
});

test("does nothing while disabled", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Disabled" }) as HTMLButtonElement;
  expect(trigger.disabled).toBe(true);
  await user.click(trigger);
  expect(getByTestId("disabled").hasAttribute("data-closed")).toBe(true);
});

test("marks the exit animation and unmounts after it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Toggle" });
  await user.click(trigger);
  const panel = getByTestId("panel");
  await expect.poll(() => panel.hasAttribute("data-starting-style")).toBe(false);

  await user.click(trigger);
  expect(panel.isConnected).toBe(true);
  expect(panel.hasAttribute("data-ending-style")).toBe(true);
  expect(panel.hasAttribute("data-closed")).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  await expect.poll(() => queryByTestId("panel")).toBeNull();
});

test("a kept panel is hidden only once its exit animation is over", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const kept = getByTestId("kept");
  const trigger = getByRole("button", { name: "Controlled" });
  await user.click(trigger);
  expect(kept.hidden).toBe(false);

  await user.click(trigger);
  expect(kept.hasAttribute("data-ending-style")).toBe(true);
  expect(kept.hidden).toBe(false);
  await expect.poll(() => kept.hidden).toBe(true);
  expect(kept.hasAttribute("data-ending-style")).toBe(false);
});

test("writes the panel's measured size to CSS variables", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const kept = getByTestId("kept");
  // jsdom has no layout: give the panel a size to measure.
  Object.defineProperty(kept, "scrollHeight", { configurable: true, get: () => 120 });
  Object.defineProperty(kept, "scrollWidth", { configurable: true, get: () => 300 });
  const trigger = getByRole("button", { name: "Controlled" });

  await user.click(trigger);
  expect(kept.style.getPropertyValue("--collapsible-panel-height")).toBe("120px");
  expect(kept.style.getPropertyValue("--collapsible-panel-width")).toBe("300px");
  // Once the open animation is over (none here), the size goes back to auto so the content can grow.
  await expect.poll(() => kept.style.getPropertyValue("--collapsible-panel-height")).toBe("auto");

  Object.defineProperty(kept, "scrollHeight", { configurable: true, get: () => 80 });
  await user.click(trigger);
  expect(kept.style.getPropertyValue("--collapsible-panel-height")).toBe("80px");
  expect(kept.hasAttribute("data-ending-style")).toBe(true);
});
