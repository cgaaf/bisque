import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";

const closed = (dialog: HTMLElement) => expect.poll(() => (dialog as HTMLDialogElement).open).toBe(false);

test("is closed until its trigger is pressed", async () => {
  const { getByRole, getByText, user } = mount(basic);
  const trigger = getByRole("button", { name: "Open dialog" });
  const dialog = getByText("Delete project").closest("dialog")!;
  expect(dialog.open).toBe(false);
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(trigger.getAttribute("aria-controls")).toBe(dialog.id);

  await user.click(trigger);
  expect(dialog.open).toBe(true);
  expect(dialog.matches(":modal")).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
});

test("is labelled by its title and described by its description", async () => {
  const { getByRole, getByText, user } = mount(basic);
  await user.click(getByRole("button", { name: "Open dialog" }));
  const dialog = getByRole("dialog", { name: "Delete project" });
  expect(dialog.getAttribute("aria-labelledby")).toBe(getByText("Delete project").id);
  expect(dialog.getAttribute("aria-describedby")).toBe(getByText("This can't be undone.").id);
});

test("the browser moves focus in, keeps it there, and returns it on close", async () => {
  const { getByRole, user } = mount(basic);
  const trigger = getByRole("button", { name: "Open dialog" });
  // Opened from the keyboard: Safari does not focus a button on click, so after a mouse press there is no
  // focused trigger for the browser to return to.
  trigger.focus();
  await user.keyboard("{Enter}");
  const dialog = getByRole("dialog");
  expect(dialog.contains(document.activeElement)).toBe(true);
  // The page behind a modal dialog is inert: Tab never reaches "Before" or the trigger.
  for (let presses = 0; presses < 4; presses += 1) {
    // oxlint-disable-next-line no-await-in-loop -- key presses happen one after another
    await user.tab();
    expect(document.activeElement).not.toBe(trigger);
    expect(document.activeElement?.textContent).not.toBe("Before");
  }
  await user.click(getByRole("button", { name: "Cancel" }));
  await closed(dialog);
  expect(document.activeElement).toBe(trigger);
});

test("closes on Escape and on a press on the backdrop", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Open dialog" });
  await user.click(trigger);
  const dialog = getByRole("dialog");
  await user.keyboard("{Escape}");
  await closed(dialog);

  await user.click(trigger);
  expect((dialog as HTMLDialogElement).open).toBe(true);
  // A point of the page outside the dialog's box: the backdrop.
  await user.click(document.body, { position: { x: 5, y: 5 } });
  await closed(dialog);
  expect(getByTestId("changes").textContent).toBe("4");
});

test("a press inside the dialog does not close it", async () => {
  const { getByRole, getByText, user } = mount(basic);
  await user.click(getByRole("button", { name: "Open dialog" }));
  await user.click(getByText("This can't be undone."));
  await frame();
  expect((getByRole("dialog") as HTMLDialogElement).open).toBe(true);
});

test("stays open with data-ending-style until its exit transition ends", async () => {
  const { getByRole, user } = mount(basic);
  await user.click(getByRole("button", { name: "Open dialog" }));
  const dialog = getByRole("dialog") as HTMLDialogElement;
  await user.keyboard("{Escape}");
  await expect.poll(() => dialog.hasAttribute("data-ending-style")).toBe(true);
  expect(dialog.open).toBe(true);
  await closed(dialog);
  expect(dialog.hasAttribute("data-ending-style")).toBe(false);
});

test("locks page scroll while a modal dialog is open", async () => {
  const { getByRole, user } = mount(basic);
  await user.click(getByRole("button", { name: "Open dialog" }));
  expect(document.documentElement.style.overflow).toBe("hidden");
  await user.keyboard("{Escape}");
  await closed(getByRole("dialog", { hidden: true }));
  expect(document.documentElement.style.overflow).toBe("");
});

test("a controlled dialog stays open until its owner agrees to close it", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  await user.click(getByRole("button", { name: "Open locked" }));
  const dialog = getByRole("dialog", { name: "Locked" }) as HTMLDialogElement;
  await user.keyboard("{Escape}");
  await frame();
  expect(dialog.open).toBe(true);
  await user.click(getByRole("button", { name: "Close" }));
  await frame();
  expect(dialog.open).toBe(true);
  expect(getByTestId("requests").textContent).toBe("3");

  await user.click(getByRole("button", { name: "Unlock" }));
  await user.keyboard("{Escape}");
  await closed(dialog);
});

test("an alert dialog ignores a press outside but closes on Escape", async () => {
  const { getByRole, user } = mount(controlled);
  await user.click(getByRole("button", { name: "Open alert" }));
  const dialog = getByRole("alertdialog", { name: "Really?" }) as HTMLDialogElement;
  await user.click(document.body, { position: { x: 5, y: 5 } });
  await frame();
  expect(dialog.open).toBe(true);
  await user.keyboard("{Escape}");
  await closed(dialog);
});

test("a non-modal dialog leaves the page usable and still closes on Escape", async () => {
  const { getByRole, user } = mount(controlled);
  await user.click(getByRole("button", { name: "Open panel" }));
  const dialog = getByRole("dialog", { name: "Panel" }) as HTMLDialogElement;
  expect(dialog.open).toBe(true);
  expect(dialog.matches(":modal")).toBe(false);
  expect(document.documentElement.style.overflow).toBe("");
  await user.keyboard("{Escape}");
  await closed(dialog);
});
