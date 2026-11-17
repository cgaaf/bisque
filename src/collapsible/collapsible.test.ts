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
  expect(queryByTestId("panel")).toBeNull();
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
