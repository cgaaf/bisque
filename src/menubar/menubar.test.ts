import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

const isOpen = (trigger: HTMLElement) => trigger.getAttribute("aria-expanded") === "true";

function triggers(getByRole: ReturnType<typeof mount>["getByRole"]) {
  return {
    file: getByRole("menuitem", { name: "File" }),
    edit: getByRole("menuitem", { name: "Edit" }),
    help: getByRole("menuitem", { name: "Help" }),
    view: getByRole("menuitem", { name: "View" }),
  };
}

test("renders a menubar whose triggers are menu items with one Tab stop", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const bar = getByRole("menubar");
  expect(bar).toBe(getByTestId("bar"));
  expect(bar.getAttribute("aria-orientation")).toBe("horizontal");
  const { file, edit, help } = triggers(getByRole);
  expect(file.getAttribute("aria-haspopup")).toBe("menu");
  expect(file.getAttribute("tabindex")).toBe("0");
  expect(edit.getAttribute("tabindex")).toBe("-1");
  expect(help.hasAttribute("disabled")).toBe(true);

  await user.tab();
  await user.tab();
  expect(document.activeElement).toBe(file);
  await user.tab();
  expect(document.activeElement).toBe(getByRole("button", { name: "After" }));
});

test("ArrowRight and ArrowLeft move between triggers, skipping disabled ones and wrapping", async () => {
  const { getByRole, user } = mount(basic);
  const { file, edit, view } = triggers(getByRole);
  file.focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(edit);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(view);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(file);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(view);
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(file);
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(view);
  expect(isOpen(view)).toBe(false);
});

test("ArrowDown opens a menu on its first item; ArrowRight in it opens the next menu and closes this one", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const { file, edit, view } = triggers(getByRole);
  file.focus();
  await user.keyboard("{ArrowDown}");
  expect(isOpen(file)).toBe(true);
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "New" }));
  expect(getByRole("menubar").hasAttribute("data-has-submenu-open")).toBe(true);

  await user.keyboard("{ArrowRight}");
  expect(isOpen(edit)).toBe(true);
  expect(isOpen(file)).toBe(false);
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Undo" }));
  await expect.poll(() => queryByTestId("file-popup")).toBeNull();

  // The disabled Help menu is skipped.
  await user.keyboard("{ArrowRight}");
  expect(isOpen(view)).toBe(true);
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Zoom" }));
  await user.keyboard("{ArrowRight}");
  expect(isOpen(file)).toBe(true);
  await user.keyboard("{ArrowLeft}");
  expect(isOpen(view)).toBe(true);
  expect(getByTestId("view-popup")).toBeTruthy();

  // Escape closes the open menu and puts focus on its trigger.
  await user.keyboard("{Escape}");
  await expect.poll(() => queryByTestId("view-popup")).toBeNull();
  expect(document.activeElement).toBe(view);
  expect(getByRole("menubar").hasAttribute("data-has-submenu-open")).toBe(false);
});

test("ArrowRight on a submenu trigger opens the submenu; ArrowLeft in the submenu goes back, not to the previous menu", async () => {
  const { getByRole, queryByTestId, user } = mount(basic);
  const { file } = triggers(getByRole);
  file.focus();
  await user.keyboard("{ArrowDown}{ArrowDown}");
  const recent = getByRole("menuitem", { name: "Recent" });
  expect(document.activeElement).toBe(recent);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "a.txt" }));
  expect(isOpen(file)).toBe(true);
  await user.keyboard("{ArrowLeft}");
  await expect.poll(() => queryByTestId("recent-popup")).toBeNull();
  expect(document.activeElement).toBe(recent);
  expect(isOpen(file)).toBe(true);
});

test("choosing an item closes the menu and returns focus to its trigger", async () => {
  const { getByRole, getByTestId, queryByRole, user } = mount(basic);
  const { edit } = triggers(getByRole);
  edit.focus();
  await user.keyboard("{Enter}");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(getByTestId("chosen").textContent).toBe("redo");
  await expect.poll(() => queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(edit);
});

test("a click opens a menu; while it is open, hovering another trigger opens that one instead", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const { file, edit, help } = triggers(getByRole);
  await user.hover(edit);
  expect(isOpen(edit)).toBe(false);

  await user.click(file);
  expect(isOpen(file)).toBe(true);
  await user.hover(edit);
  expect(isOpen(edit)).toBe(true);
  expect(isOpen(file)).toBe(false);
  expect(getByTestId("edit-popup")).toBeTruthy();
  // A disabled menu doesn't open on hover.
  await user.hover(help);
  expect(isOpen(help)).toBe(false);
  expect(isOpen(edit)).toBe(true);

  // A click on another trigger switches too, and a click on the open one closes it.
  await user.click(file);
  expect(isOpen(file)).toBe(true);
  expect(isOpen(edit)).toBe(false);
  await user.click(file);
  expect(isOpen(file)).toBe(false);
  await expect.poll(() => queryByTestId("file-popup")).toBeNull();
});

test("a press outside closes the open menu", async () => {
  const { getByRole, getByTestId, queryByRole, user } = mount(basic);
  await user.click(triggers(getByRole).file);
  await user.click(getByTestId("outside"));
  await expect.poll(() => queryByRole("menu")).toBeNull();
});
