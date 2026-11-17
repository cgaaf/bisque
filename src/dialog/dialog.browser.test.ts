import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";
import nativeClose from "./fixtures/native-close.rx";

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

test("locking scroll keeps the scrollbar's space, so the page doesn't shift", async () => {
  const root = document.documentElement;
  const tall = document.body.appendChild(document.createElement("div"));
  tall.style.height = "300vh";
  // Headless browsers draw overlay scrollbars, which take no space. A styled one does, in Chromium and WebKit.
  const style = document.head.appendChild(document.createElement("style"));
  style.textContent = "::-webkit-scrollbar { width: 15px; background: #eee }";
  try {
    const { getByRole, user } = mount(basic);
    const button = getByRole("button", { name: "Open dialog" });
    const width = document.body.getBoundingClientRect().width;
    const left = button.getBoundingClientRect().left;
    await user.click(button);
    expect(root.style.overflow).toBe("hidden");
    expect(document.body.getBoundingClientRect().width).toBe(width);
    expect(button.getBoundingClientRect().left).toBe(left);
    await user.keyboard("{Escape}");
    await closed(getByRole("dialog", { hidden: true }));
    expect(root.getAttribute("style") ?? "").toBe("");
    expect(document.body.getBoundingClientRect().width).toBe(width);
  } finally {
    tall.remove();
    style.remove();
  }
});

test("the page stays locked while the dialog animates out, so the dialog doesn't jump sideways", async () => {
  const root = document.documentElement;
  const tall = document.body.appendChild(document.createElement("div"));
  tall.style.height = "300vh";
  const style = document.head.appendChild(document.createElement("style"));
  style.textContent = "::-webkit-scrollbar { width: 15px; background: #eee }";
  try {
    const { getByRole, user } = mount(basic);
    await user.click(getByRole("button", { name: "Open dialog" }));
    const dialog = getByRole("dialog") as HTMLDialogElement;
    const width = root.clientWidth;
    await user.keyboard("{Escape}");
    await expect.poll(() => dialog.hasAttribute("data-ending-style")).toBe(true);
    // The scrollbar coming back now would re-centre the leaving dialog.
    expect(root.style.overflow).toBe("hidden");
    expect(root.clientWidth).toBe(width);
    await closed(dialog);
    expect(root.getAttribute("style") ?? "").toBe("");
  } finally {
    tall.remove();
    style.remove();
  }
});

test("reopened while it animates out, the dialog keeps its lock, and gives it up when it closes", async () => {
  const { getByRole, user } = mount(basic);
  const trigger = getByRole("button", { name: "Open dialog" });
  await user.click(trigger);
  const dialog = getByRole("dialog") as HTMLDialogElement;
  await user.keyboard("{Escape}");
  await expect.poll(() => dialog.hasAttribute("data-ending-style")).toBe(true);
  trigger.click();
  await expect.poll(() => dialog.hasAttribute("data-ending-style")).toBe(false);
  expect(dialog.open).toBe(true);
  expect(document.documentElement.style.overflow).toBe("hidden");
  await user.keyboard("{Escape}");
  await closed(dialog);
  expect(document.documentElement.style.overflow).toBe("");
});

test("a page without a scrollbar gets no gutter while locked", async () => {
  const { getByRole, user } = mount(basic);
  await user.click(getByRole("button", { name: "Open dialog" }));
  expect(document.documentElement.style.scrollbarGutter).toBe("");
  await user.keyboard("{Escape}");
  await closed(getByRole("dialog", { hidden: true }));
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

test("a controlled dialog refuses a close the browser would do itself: a dialog form or a close command", async () => {
  const { getByRole, getByTestId, user } = mount(nativeClose);
  await user.click(getByRole("button", { name: "Open locked" }));
  const dialog = getByTestId("locked") as HTMLDialogElement;
  for (const name of ["Save", "Keep", "Dismiss"]) {
    // oxlint-disable-next-line no-await-in-loop -- each press acts on the dialog the one before left open
    await user.click(getByRole("button", { name }));
    // oxlint-disable-next-line no-await-in-loop
    await frame();
    expect(dialog.open).toBe(true);
    expect(dialog.matches(":modal")).toBe(true);
  }
  // Opening, then one request for each press.
  expect(getByTestId("requests").textContent).toBe("4");
  expect(getByTestId("returned").textContent).toBe("");

  // Once the owner agrees, the close goes ahead with the button's value as the dialog's return value.
  await user.click(getByRole("button", { name: "Unlock" }));
  await user.click(getByRole("button", { name: "Save" }));
  await closed(dialog);
  // The close event that carries it comes in a later task.
  await expect.poll(() => getByTestId("returned").textContent).toBe("saved");
  await user.click(getByRole("button", { name: "Open locked" }));
  await user.click(getByRole("button", { name: "Dismiss" }));
  await closed(dialog);
  await expect.poll(() => getByTestId("returned").textContent).toBe("commanded");
});

test("a close by a dialog form or a close command runs the exit animation", async () => {
  const { getByRole, user } = mount(nativeClose);
  for (const name of ["Done", "Hide"]) {
    // oxlint-disable-next-line no-await-in-loop -- one close after the other
    await user.click(getByRole("button", { name: "Open animated" }));
    const dialog = getByRole("dialog", { name: "Animated" }) as HTMLDialogElement;
    // oxlint-disable-next-line no-await-in-loop
    await user.click(getByRole("button", { name }));
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => dialog.hasAttribute("data-ending-style")).toBe(true);
    expect(dialog.open).toBe(true);
    // oxlint-disable-next-line no-await-in-loop
    await closed(dialog);
    expect(dialog.hasAttribute("data-ending-style")).toBe(false);
  }
});

test("a close by script, which can't be stopped, is reported and undone if the owner refuses it", async () => {
  const { getByRole, getByTestId, user } = mount(nativeClose);
  await user.click(getByRole("button", { name: "Open locked" }));
  const dialog = getByTestId("locked") as HTMLDialogElement;
  dialog.close();
  await expect.poll(() => dialog.open).toBe(true);
  expect(dialog.matches(":modal")).toBe(true);
  expect(getByTestId("requests").textContent).toBe("2");
});

test("a close by script that the owner accepts stays closed, and a close with no value leaves returnValue empty", async () => {
  const { getByRole, user } = mount(nativeClose);
  await user.click(getByRole("button", { name: "Open animated" }));
  const dialog = getByRole("dialog", { name: "Animated" }) as HTMLDialogElement;
  const opened: string[] = [];
  dialog.addEventListener("toggle", (event) => opened.push(event.newState));
  dialog.close();
  await frame();
  await frame();
  expect(dialog.open).toBe(false);
  expect(dialog.hasAttribute("data-ending-style")).toBe(false);
  await expect.poll(() => opened).toEqual(["closed"]);

  dialog.returnValue = "";
  await user.click(getByRole("button", { name: "Open animated" }));
  await user.click(getByRole("button", { name: "Done" }));
  await closed(dialog);
  expect(dialog.returnValue).toBe("");
});
