import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";

const shown = (popup: HTMLElement) => popup.matches(":popover-open");

test("is closed until the trigger is pressed, then wires ARIA and focuses the popup", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Actions" });
  const popup = getByTestId("popup");
  expect(shown(popup)).toBe(false);
  expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(trigger.getAttribute("aria-controls")).toBe(popup.id);

  await user.click(trigger);
  expect(shown(popup)).toBe(true);
  expect(getByRole("menu")).toBe(popup);
  await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.hasAttribute("data-popup-open")).toBe(true);
  await expect.poll(() => document.activeElement).toBe(popup);
  expect(getByTestId("changes").textContent).toBe("1");
});

test("the browser places it below the trigger, start edges aligned, sideOffset away", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Actions" });
  await user.click(trigger);
  await frame();
  const anchor = trigger.getBoundingClientRect();
  const placed = getByTestId("popup").getBoundingClientRect();
  expect(Math.round(placed.top - anchor.bottom)).toBe(4);
  expect(Math.round(placed.left - anchor.left)).toBe(0);
});

test("pressing the trigger again closes it, and so does a press outside", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Actions" });
  const popup = getByTestId("popup");
  await user.click(trigger);
  await user.click(trigger);
  await expect.poll(() => shown(popup)).toBe(false);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  await user.click(trigger);
  expect(shown(popup)).toBe(true);
  await user.click(getByTestId("outside"));
  expect(shown(popup)).toBe(false);
  await expect.poll(() => getByTestId("changes").textContent).toBe("4");
});

test("arrow keys move through enabled items and wrap", async () => {
  const { getByRole, user } = mount(basic);
  getByRole("button", { name: "Actions" }).focus();
  await user.keyboard("{ArrowDown}");
  const rename = getByRole("menuitem", { name: "Rename" });
  await expect.poll(() => document.activeElement).toBe(rename);
  expect(rename.hasAttribute("data-highlighted")).toBe(true);

  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Delete" }));
  expect(rename.hasAttribute("data-highlighted")).toBe(false);
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(getByRole("menuitemradio", { name: "Date" }));
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(rename);
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(getByRole("menuitemradio", { name: "Date" }));
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(rename);
});

test("ArrowUp on the trigger opens on the last item; Enter and Space on the first", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Actions" });
  const popup = getByTestId("popup");
  trigger.focus();
  await user.keyboard("{ArrowUp}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitemradio", { name: "Date" }));
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
  expect(document.activeElement).toBe(trigger);

  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Rename" }));
  await user.keyboard("{Escape}");
  expect(document.activeElement).toBe(trigger);

  await user.keyboard(" ");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Rename" }));
  await frame();
  expect(shown(popup)).toBe(true);
  expect(getByTestId("changes").textContent).toBe("5");
});

test("typing moves to the item that starts with the letters", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Actions" }));
  await expect.poll(() => document.activeElement).toBe(getByTestId("popup"));
  await user.keyboard("d");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Delete" }));
  await user.keyboard("d");
  expect(document.activeElement).toBe(getByRole("menuitemradio", { name: "Date" }));
});

test("choosing an item runs its handler, closes, and returns focus to the trigger", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Actions" });
  trigger.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Rename" }));
  await user.keyboard("{ArrowDown}{Enter}");
  expect(getByTestId("chosen").textContent).toBe("delete");
  await expect.poll(() => shown(getByTestId("popup"))).toBe(false);
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("a pointer moving over an item highlights it, and a click chooses it", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Actions" }));
  const rename = getByRole("menuitem", { name: "Rename" });
  await user.hover(rename);
  expect(document.activeElement).toBe(rename);
  expect(rename.hasAttribute("data-highlighted")).toBe(true);
  await user.click(rename);
  expect(getByTestId("chosen").textContent).toBe("rename");
  await expect.poll(() => shown(getByTestId("popup"))).toBe(false);
});

test("a disabled item can't be chosen", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Actions" }));
  const archive = getByRole("menuitem", { name: "Archive" });
  expect(archive.getAttribute("aria-disabled")).toBe("true");
  expect(archive.hasAttribute("data-disabled")).toBe(true);
  // Playwright won't press an element marked aria-disabled unless forced.
  await user.click(archive, { force: true });
  expect(getByTestId("chosen").textContent).toBe("none");
  expect(shown(getByTestId("popup"))).toBe(true);
});

test("checkbox and radio items update their state and keep the menu open", async () => {
  const { getByRole, getByTestId, getByText, user } = mount(basic);
  await user.click(getByRole("button", { name: "Actions" }));
  const wrap = getByRole("menuitemcheckbox", { name: "Word wrap" });
  expect(wrap.getAttribute("aria-checked")).toBe("false");
  expect(wrap.hasAttribute("data-unchecked")).toBe(true);
  await user.click(wrap);
  expect(wrap.getAttribute("aria-checked")).toBe("true");
  expect(wrap.hasAttribute("data-checked")).toBe(true);
  expect(getByTestId("wrap").textContent).toBe("on");

  const date = getByRole("menuitemradio", { name: "Date" });
  await user.click(date);
  expect(date.getAttribute("aria-checked")).toBe("true");
  expect(getByRole("menuitemradio", { name: "Name" }).getAttribute("aria-checked")).toBe("false");
  expect(getByTestId("sort").textContent).toBe("date");
  expect(getByRole("group", { name: "Sort by" })).toBe(getByText("Sort by").parentElement);
  expect(shown(getByTestId("popup"))).toBe(true);

  // Space toggles a checkbox item from the keyboard.
  wrap.focus();
  await user.keyboard(" ");
  expect(getByTestId("wrap").textContent).toBe("off");
  expect(shown(getByTestId("popup"))).toBe(true);
});

test("Escape and Tab close the menu", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Actions" });
  const popup = getByTestId("popup");
  await user.click(trigger);
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
  await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("false");
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Rename" }));
  await user.tab();
  await expect.poll(() => shown(popup)).toBe(false);
  expect(getByTestId("changes").textContent).toBe("4");
});

test("can be controlled; a disabled menu doesn't open", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  const popup = getByTestId("controlled-popup");
  await user.click(getByRole("button", { name: "Open from outside" }));
  await expect.poll(() => shown(popup)).toBe(true);
  expect(getByRole("button", { name: "Controlled" }).getAttribute("aria-expanded")).toBe("true");
  await user.keyboard("{Escape}");
  await expect.poll(() => getByTestId("open").textContent).toBe("closed");
  expect(shown(popup)).toBe(false);

  const disabled = getByRole("button", { name: "Disabled" });
  expect(disabled.hasAttribute("disabled")).toBe(true);
  expect(disabled.hasAttribute("data-disabled")).toBe(true);
  disabled.focus();
  await user.keyboard("{ArrowDown}");
  expect(shown(getByTestId("disabled-popup"))).toBe(false);
});
