import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";
import nativeClose from "./fixtures/native-close.rx";

const closed = (dialog: HTMLElement) => expect.poll(() => (dialog as HTMLDialogElement).open).toBe(false);

test("opens as a modal alertdialog labelled by its title and description", async () => {
  const { getByRole, queryByRole, getByText, user } = mount(basic);
  expect(queryByRole("alertdialog")).toBeNull();
  const trigger = getByRole("button", { name: "Discard draft" });
  await user.click(trigger);

  const popup = getByRole("alertdialog") as HTMLDialogElement;
  expect(popup.matches(":modal")).toBe(true);
  expect(popup.getAttribute("aria-labelledby")).toBe(getByText("Discard draft?").id);
  expect(popup.getAttribute("aria-describedby")).toBe(getByText("You can't undo this action.").id);
  expect(trigger.getAttribute("aria-controls")).toBe(popup.id);
  expect(document.documentElement.style.overflow).toBe("hidden");
});

test("a press outside does not close it", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Discard draft" }));
  await user.click(document.body, { position: { x: 5, y: 5 } });
  await frame();
  expect((getByRole("alertdialog") as HTMLDialogElement).open).toBe(true);
  expect(getByTestId("changes").textContent).toBe("1");
});

test("Escape closes it and returns focus to the trigger", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Discard draft" });
  trigger.focus();
  await user.keyboard("{Enter}");
  const popup = getByRole("alertdialog");
  await user.keyboard("{Escape}");
  await closed(popup);
  expect(document.activeElement).toBe(trigger);
  expect(getByTestId("changes").textContent).toBe("2");
  expect(document.documentElement.style.overflow).toBe("");
});

test("closes from either button, running the consumer's handler", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Discard draft" }));
  const popup = getByRole("alertdialog");
  await user.click(getByRole("button", { name: "Discard" }));
  await closed(popup);
  expect(getByTestId("discarded").textContent).toBe("yes");
});

test("can be controlled", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  await user.click(getByRole("button", { name: "Open from outside" }));
  const popup = getByRole("alertdialog");
  await user.click(getByRole("button", { name: "Stay" }));
  expect(getByTestId("open").textContent).toBe("closed");
  await closed(popup);
});

test("a dialog form's close waits for the owner, and animates out once it agrees", async () => {
  const { getByRole, getByTestId, user } = mount(nativeClose);
  await user.click(getByRole("button", { name: "Delete" }));
  const popup = getByRole("alertdialog") as HTMLDialogElement;
  await user.click(getByRole("button", { name: "Confirm" }));
  await frame();
  expect(popup.open).toBe(true);
  expect(popup.matches(":modal")).toBe(true);
  expect(getByTestId("requests").textContent).toBe("2");

  await user.click(getByRole("button", { name: "Unlock" }));
  await user.click(getByRole("button", { name: "Confirm" }));
  await expect.poll(() => popup.hasAttribute("data-ending-style")).toBe(true);
  expect(popup.open).toBe(true);
  await closed(popup);
  expect(popup.returnValue).toBe("delete");
});
