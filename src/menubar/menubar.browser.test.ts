import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";

type Mounted = ReturnType<typeof mount>;
const isOpen = (trigger: HTMLElement) => trigger.getAttribute("aria-expanded") === "true";
const shown = (popup: HTMLElement) => popup.matches(":popover-open");

function triggers({ getByRole }: Mounted) {
  return {
    file: getByRole("menuitem", { name: "File" }),
    edit: getByRole("menuitem", { name: "Edit" }),
    help: getByRole("menuitem", { name: "Help" }),
    view: getByRole("menuitem", { name: "View" }),
  };
}

test("renders a menubar whose triggers are menu items with one Tab stop", async () => {
  const m = mount(basic);
  const { getByRole, getByTestId } = m;
  const bar = getByRole("menubar");
  expect(bar).toBe(getByTestId("bar"));
  expect(bar.getAttribute("aria-orientation")).toBe("horizontal");
  const { file, edit, help } = triggers(m);
  expect(file.getAttribute("aria-haspopup")).toBe("menu");
  expect(file.getAttribute("tabindex")).toBe("0");
  expect(edit.getAttribute("tabindex")).toBe("-1");
  expect(help.hasAttribute("disabled")).toBe(true);
  // The menus' items are not stops of the bar.
  expect(getByRole("menuitem", { hidden: true, name: "New" }).getAttribute("tabindex")).toBe("-1");
});

test("ArrowRight and ArrowLeft move between triggers, skipping disabled ones and wrapping", async () => {
  const m = mount(basic);
  const { file, edit, view } = triggers(m);
  file.focus();
  await m.user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(edit);
  expect(edit.getAttribute("tabindex")).toBe("0");
  expect(file.getAttribute("tabindex")).toBe("-1");
  await m.user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(view);
  await m.user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(file);
  await m.user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(view);
  await m.user.keyboard("{Home}");
  expect(document.activeElement).toBe(file);
  await m.user.keyboard("{End}");
  expect(document.activeElement).toBe(view);
  expect(isOpen(view)).toBe(false);
});

test("ArrowDown opens a menu on its first item; ArrowRight in it opens the next menu and closes this one", async () => {
  const m = mount(basic);
  const { getByRole, getByTestId, user } = m;
  const { file, edit, view } = triggers(m);
  file.focus();
  await user.keyboard("{ArrowDown}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "New" }));
  expect(isOpen(file)).toBe(true);
  expect(getByRole("menubar").hasAttribute("data-has-submenu-open")).toBe(true);
  // Placed below its trigger.
  await frame();
  expect(Math.round(getByTestId("file-popup").getBoundingClientRect().top)).toBe(
    Math.round(file.getBoundingClientRect().bottom),
  );

  await user.keyboard("{ArrowRight}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Undo" }));
  expect(isOpen(edit)).toBe(true);
  expect(isOpen(file)).toBe(false);
  expect(shown(getByTestId("file-popup"))).toBe(false);
  expect(shown(getByTestId("edit-popup"))).toBe(true);

  // The disabled Help menu is skipped.
  await user.keyboard("{ArrowRight}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Zoom" }));
  expect(isOpen(view)).toBe(true);
  await user.keyboard("{ArrowRight}");
  await expect.poll(() => isOpen(file)).toBe(true);
  await user.keyboard("{ArrowLeft}");
  await expect.poll(() => isOpen(view)).toBe(true);
  expect(shown(getByTestId("view-popup"))).toBe(true);

  // Escape closes the open menu and puts focus on its trigger.
  await user.keyboard("{Escape}");
  expect(shown(getByTestId("view-popup"))).toBe(false);
  await expect.poll(() => document.activeElement).toBe(view);
  expect(getByRole("menubar").hasAttribute("data-has-submenu-open")).toBe(false);
});

test("ArrowRight on a submenu trigger opens the submenu; ArrowLeft in the submenu goes back, not to the previous menu", async () => {
  const m = mount(basic);
  const { getByRole, getByTestId, user } = m;
  const { file } = triggers(m);
  file.focus();
  await user.keyboard("{ArrowDown}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "New" }));
  await user.keyboard("{ArrowDown}");
  const recent = getByRole("menuitem", { name: "Recent" });
  expect(document.activeElement).toBe(recent);
  await user.keyboard("{ArrowRight}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "a.txt" }));
  expect(isOpen(file)).toBe(true);
  await user.keyboard("{ArrowLeft}");
  await expect.poll(() => shown(getByTestId("recent-popup"))).toBe(false);
  expect(document.activeElement).toBe(recent);
  expect(isOpen(file)).toBe(true);
});

test("choosing an item closes the menu and returns focus to its trigger", async () => {
  const m = mount(basic);
  const { getByRole, getByTestId, user } = m;
  const { edit } = triggers(m);
  edit.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Undo" }));
  await user.keyboard("{ArrowDown}{Enter}");
  expect(getByTestId("chosen").textContent).toBe("redo");
  await expect.poll(() => shown(getByTestId("edit-popup"))).toBe(false);
  expect(document.activeElement).toBe(edit);
});

test("a click opens a menu; while it is open, hovering another trigger opens that one instead", async () => {
  const m = mount(basic);
  const { getByTestId, user } = m;
  const { file, edit, help } = triggers(m);
  await user.hover(edit);
  expect(isOpen(edit)).toBe(false);

  await user.click(file);
  await expect.poll(() => shown(getByTestId("file-popup"))).toBe(true);
  await user.hover(edit);
  await expect.poll(() => isOpen(edit)).toBe(true);
  expect(isOpen(file)).toBe(false);
  expect(shown(getByTestId("edit-popup"))).toBe(true);
  expect(shown(getByTestId("file-popup"))).toBe(false);
  // A click on the trigger that hovering opened keeps it open.
  await user.click(edit);
  await frame();
  expect(shown(getByTestId("edit-popup"))).toBe(true);
  // A disabled menu doesn't open on hover.
  await user.hover(help);
  await frame();
  expect(isOpen(help)).toBe(false);
  expect(isOpen(edit)).toBe(true);

  // A click on another trigger switches too, and a click on the open one closes it.
  await user.click(file, { position: { x: 2, y: 2 } });
  await expect.poll(() => shown(getByTestId("file-popup"))).toBe(true);
  expect(isOpen(edit)).toBe(false);
  await user.click(file);
  await expect.poll(() => shown(getByTestId("file-popup"))).toBe(false);
  expect(isOpen(file)).toBe(false);
});

test("a press outside closes the open menu", async () => {
  const m = mount(basic);
  const { getByTestId, user } = m;
  const { file } = triggers(m);
  await user.click(file);
  await expect.poll(() => shown(getByTestId("file-popup"))).toBe(true);
  await user.click(getByTestId("outside"));
  expect(shown(getByTestId("file-popup"))).toBe(false);
  await expect.poll(() => isOpen(file)).toBe(false);
  expect(getByTestId("bar").hasAttribute("data-has-submenu-open")).toBe(false);
});
