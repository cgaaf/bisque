import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";

test("opens as a modal alertdialog labelled by its title and description", async () => {
  const { getByRole, queryByRole, getByText, user } = mount(basic);
  expect(queryByRole("alertdialog")).toBeNull();
  const trigger = getByRole("button", { name: "Discard draft" });
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");

  await user.click(trigger);
  const popup = getByRole("alertdialog");
  expect(queryByRole("dialog")).toBeNull();
  expect(popup.getAttribute("aria-modal")).toBe("true");
  expect(popup.getAttribute("aria-labelledby")).toBe(getByText("Discard draft?").id);
  expect(popup.getAttribute("aria-describedby")).toBe(getByText("You can't undo this action.").id);
  expect(trigger.getAttribute("aria-controls")).toBe(popup.id);
  expect(document.documentElement.style.overflow).toBe("hidden");
});

test("a press outside does not close it", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Discard draft" }));
  await user.click(getByTestId("backdrop"));
  await user.click(document.body);
  expect(getByRole("alertdialog").hasAttribute("data-open")).toBe(true);
  expect(getByTestId("changes").textContent).toBe("1");
});

test("Escape closes it and returns focus to the trigger", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Discard draft" });
  await user.click(trigger);
  await user.keyboard("{Escape}");
  await expect.poll(() => queryByRole("alertdialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(getByTestId("changes").textContent).toBe("2");
  expect(document.documentElement.style.overflow).toBe("");
});

test("traps focus and closes from either button", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Discard draft" }));
  const cancel = getByRole("button", { name: "Cancel" });
  const discard = getByRole("button", { name: "Discard" });
  expect(document.activeElement).toBe(cancel);
  await user.tab();
  expect(document.activeElement).toBe(discard);
  await user.tab();
  expect(document.activeElement).toBe(cancel);

  await user.click(discard);
  await expect.poll(() => queryByRole("alertdialog")).toBeNull();
  expect(getByTestId("discarded").textContent).toBe("yes");
});

test("can be controlled", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(controlled);
  await user.click(getByRole("button", { name: "Open from outside" }));
  expect(getByRole("alertdialog")).toBeTruthy();
  await user.click(getByRole("button", { name: "Stay" }));
  expect(getByTestId("open").textContent).toBe("closed");
  await expect.poll(() => queryByRole("alertdialog")).toBeNull();
});
