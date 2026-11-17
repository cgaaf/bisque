import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

test("is not rendered until opened", () => {
  const { queryByRole, getByRole } = mount(basic);
  expect(queryByRole("dialog")).toBeNull();
  const trigger = getByRole("button", { name: "Open dialog" });
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("opens in a portal, labelled by its title and description", async () => {
  const { getByRole, getByText, container, user } = mount(basic);
  const trigger = getByRole("button", { name: "Open dialog" });
  await user.click(trigger);

  const popup = getByRole("dialog");
  expect(container.contains(popup)).toBe(false);
  expect(document.body.contains(popup)).toBe(true);
  expect(popup.getAttribute("aria-modal")).toBe("true");
  expect(popup.getAttribute("aria-labelledby")).toBe(getByText("Delete project").id);
  expect(popup.getAttribute("aria-describedby")).toBe(getByText("This can't be undone.").id);
  expect(popup.hasAttribute("data-open")).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.getAttribute("aria-controls")).toBe(popup.id);
});

test("moves focus in, traps Tab, and restores focus on close", async () => {
  const { getByRole, queryByRole, user } = mount(basic);
  const trigger = getByRole("button", { name: "Open dialog" });
  await user.click(trigger);

  const confirm = getByRole("button", { name: "Confirm" });
  const cancel = getByRole("button", { name: "Cancel" });
  expect(document.activeElement).toBe(confirm);
  await user.tab();
  expect(document.activeElement).toBe(cancel);
  await user.tab();
  expect(document.activeElement).toBe(confirm);
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(cancel);

  await user.click(cancel);
  await expect.poll(() => queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test("closes on Escape and on a press outside", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Open dialog" });

  await user.click(trigger);
  await user.keyboard("{Escape}");
  await expect.poll(() => queryByRole("dialog")).toBeNull();

  await user.click(trigger);
  expect(getByRole("dialog")).toBeTruthy();
  await user.click(getByTestId("backdrop"));
  await expect.poll(() => queryByRole("dialog")).toBeNull();
  expect(getByTestId("changes").textContent).toBe("4");
});

test("locks page scroll while a modal dialog is open", async () => {
  const { getByRole, user } = mount(basic);
  await user.click(getByRole("button", { name: "Open dialog" }));
  expect(document.documentElement.style.overflow).toBe("hidden");
  await user.keyboard("{Escape}");
  expect(document.documentElement.style.overflow).toBe("");
});
