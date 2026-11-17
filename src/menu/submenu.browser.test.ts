import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import submenu from "./fixtures/submenu.rx";

type Mounted = ReturnType<typeof mount>;
const shown = (popup: HTMLElement) => popup.matches(":popover-open");

async function openRootWithKeyboard({ getByRole }: Mounted, user: Mounted["user"]) {
  getByRole("button", { name: "File" }).focus();
  await user.keyboard("{ArrowDown}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "New" }));
}

/** Opens the root menu and then Share's submenu from the keyboard, landing on Email. */
async function openShare(m: Mounted) {
  await openRootWithKeyboard(m, m.user);
  await m.user.keyboard("{ArrowDown}{ArrowRight}");
  await expect.poll(() => document.activeElement).toBe(m.getByRole("menuitem", { name: "Email" }));
}

test("the submenu trigger is an item of the parent menu, wired as a popup button", async () => {
  const m = mount(submenu);
  const { getByRole, getByTestId, user } = m;
  await openRootWithKeyboard(m, user);
  const share = getByRole("menuitem", { name: "Share" });
  expect(share.getAttribute("aria-haspopup")).toBe("menu");
  expect(share.getAttribute("aria-expanded")).toBe("false");
  expect(share.getAttribute("aria-controls")).toBe(getByTestId("sub-popup").id);
  expect(shown(getByTestId("sub-popup"))).toBe(false);
  // Arrow keys in the parent menu reach the submenu trigger, and skip the submenu's items.
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(share);
  expect(share.hasAttribute("data-highlighted")).toBe(true);
  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Print" }));
  // Typeahead too: "e" finds Export, not the submenu's Email.
  await user.keyboard("e");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Export" }));
});

test("ArrowRight opens the submenu beside its trigger, on its first item; ArrowLeft closes it back to the trigger", async () => {
  const m = mount(submenu);
  const { getByRole, getByTestId, user } = m;
  await openShare(m);
  const share = getByRole("menuitem", { name: "Share" });
  const popup = getByTestId("sub-popup");
  expect(shown(popup)).toBe(true);
  expect(share.getAttribute("aria-expanded")).toBe("true");
  expect(share.hasAttribute("data-popup-open")).toBe(true);
  expect(getByTestId("sub-changes").textContent).toBe("1");
  // Placed on the right of the trigger, top edges aligned.
  await frame();
  const anchor = share.getBoundingClientRect();
  const placed = popup.getBoundingClientRect();
  expect(Math.round(placed.left - anchor.right)).toBe(0);
  expect(Math.round(placed.top - anchor.top)).toBe(0);

  // Arrow keys stay inside the submenu.
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("menuitemcheckbox", { name: "Notify" }));

  await user.keyboard("{ArrowLeft}");
  await expect.poll(() => shown(popup)).toBe(false);
  expect(document.activeElement).toBe(share);
  expect(shown(getByTestId("root-popup"))).toBe(true);
  expect(share.getAttribute("aria-expanded")).toBe("false");
});

test("Enter and Space on the trigger open the submenu too", async () => {
  const m = mount(submenu);
  const { getByRole, getByTestId, user } = m;
  await openRootWithKeyboard(m, user);
  await user.keyboard("{ArrowDown}{Enter}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Email" }));
  await user.keyboard("{ArrowLeft}");
  await expect.poll(() => shown(getByTestId("sub-popup"))).toBe(false);
  await user.keyboard(" ");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Email" }));
  await frame();
  expect(shown(getByTestId("sub-popup"))).toBe(true);
});

test("choosing a submenu item closes the whole tree and returns focus to the root trigger", async () => {
  const m = mount(submenu);
  const { getByRole, getByTestId, user } = m;
  const trigger = getByRole("button", { name: "File" });
  await openShare(m);
  await user.keyboard("{Enter}");
  expect(getByTestId("chosen").textContent).toBe("email");
  await expect.poll(() => shown(getByTestId("root-popup"))).toBe(false);
  expect(shown(getByTestId("sub-popup"))).toBe(false);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(getByRole("menuitem", { hidden: true, name: "Share" }).getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);
});

test("a checkbox item in the submenu keeps the tree open", async () => {
  const m = mount(submenu);
  const { getByRole, getByTestId, user } = m;
  await openShare(m);
  await user.click(getByRole("menuitemcheckbox", { name: "Notify" }));
  expect(getByTestId("wrap").textContent).toBe("on");
  expect(shown(getByTestId("sub-popup"))).toBe(true);
  expect(shown(getByTestId("root-popup"))).toBe(true);
});

test("Escape closes only the innermost menu, a level at a time, returning focus to each trigger", async () => {
  const m = mount(submenu);
  const { getByRole, getByTestId, user } = m;
  const trigger = getByRole("button", { name: "File" });
  await openShare(m);
  await user.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}");
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Fax" }));
  await user.keyboard("{Escape}");
  expect(shown(getByTestId("more-popup"))).toBe(false);
  expect(shown(getByTestId("sub-popup"))).toBe(true);
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "More" }));
  await user.keyboard("{Escape}");
  expect(shown(getByTestId("sub-popup"))).toBe(false);
  expect(shown(getByTestId("root-popup"))).toBe(true);
  await expect.poll(() => document.activeElement).toBe(getByRole("menuitem", { name: "Share" }));
  await user.keyboard("{Escape}");
  expect(shown(getByTestId("root-popup"))).toBe(false);
  await expect.poll(() => document.activeElement).toBe(trigger);
});

test("Escape closes only a submenu that hovering opened", async () => {
  const { getByRole, getByTestId, user } = mount(submenu);
  await user.click(getByRole("button", { name: "File" }));
  await user.hover(getByRole("menuitem", { name: "Share" }));
  await expect.poll(() => shown(getByTestId("sub-popup"))).toBe(true);
  await user.hover(getByRole("menuitem", { name: "More" }));
  await expect.poll(() => shown(getByTestId("more-popup"))).toBe(true);
  await user.keyboard("{Escape}");
  expect(shown(getByTestId("more-popup"))).toBe(false);
  expect(shown(getByTestId("sub-popup"))).toBe(true);
  expect(shown(getByTestId("root-popup"))).toBe(true);
});

test("a press elsewhere in the parent menu closes the submenu but not the parent; a press outside closes both", async () => {
  const m = mount(submenu);
  const { getByRole, getByTestId, user } = m;
  await openShare(m);
  // A press on the submenu's own trigger keeps it open.
  await user.click(getByRole("menuitem", { name: "Share" }));
  expect(shown(getByTestId("sub-popup"))).toBe(true);
  await user.click(getByRole("menuitem", { name: "Export" }), { position: { x: 2, y: 2 } });
  await expect.poll(() => shown(getByTestId("sub-popup"))).toBe(false);
  expect(shown(getByTestId("root-popup"))).toBe(true);
  await user.click(getByRole("menuitem", { name: "Share" }));
  await expect.poll(() => shown(getByTestId("sub-popup"))).toBe(true);
  await user.click(getByTestId("outside"));
  expect(shown(getByTestId("sub-popup"))).toBe(false);
  expect(shown(getByTestId("root-popup"))).toBe(false);
  await expect.poll(() => getByRole("button", { name: "File" }).getAttribute("aria-expanded")).toBe("false");
});

test("Tab in the submenu closes the whole tree", async () => {
  const m = mount(submenu);
  const { getByTestId, user } = m;
  await openShare(m);
  await user.tab();
  await expect.poll(() => shown(getByTestId("root-popup"))).toBe(false);
  expect(shown(getByTestId("sub-popup"))).toBe(false);
});

test("hovering the trigger opens the submenu after the delay, without moving focus into it", async () => {
  const { getByRole, getByTestId, user } = mount(submenu);
  await user.click(getByRole("button", { name: "File" }));
  const share = getByRole("menuitem", { name: "Share" });
  const popup = getByTestId("sub-popup");
  const start = performance.now();
  await user.hover(share);
  expect(document.activeElement).toBe(share);
  await expect.poll(() => shown(popup)).toBe(true);
  expect(performance.now() - start).toBeGreaterThanOrEqual(100);
  expect(document.activeElement).toBe(share);

  // ArrowRight on a hover-opened submenu moves focus into it.
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Email" }));
});

test("leaving the trigger for another item closes the submenu; ArrowDown on the trigger does too", async () => {
  const { getByRole, getByTestId, user } = mount(submenu);
  await user.click(getByRole("button", { name: "File" }));
  const share = getByRole("menuitem", { name: "Share" });
  const popup = getByTestId("sub-popup");
  await user.hover(share);
  await expect.poll(() => shown(popup)).toBe(true);
  // Straight down, away from the submenu. Playwright moves the pointer in one step; a person's pointer reports
  // more than one position on the way, and the second is where it is seen to have left the safe area.
  const print = getByRole("menuitem", { name: "Print" });
  await user.hover(print, { position: { x: 5, y: 5 } });
  await user.hover(print, { position: { x: 6, y: 8 } });
  await expect.poll(() => shown(popup)).toBe(false);
  expect(share.getAttribute("aria-expanded")).toBe("false");

  await user.hover(share);
  await expect.poll(() => shown(popup)).toBe(true);
  share.focus();
  await user.keyboard("{ArrowDown}");
  await expect.poll(() => shown(popup)).toBe(false);
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Export" }));
});

test("crossing another item on the way to the submenu keeps it open (safe area)", async () => {
  const { getByRole, getByTestId, user } = mount(submenu);
  await user.click(getByRole("button", { name: "File" }));
  const share = getByRole("menuitem", { name: "Share" });
  const exportItem = getByRole("menuitem", { name: "Export" });
  const popup = getByTestId("sub-popup");
  await user.hover(share, { position: { x: 100, y: 20 } });
  await expect.poll(() => shown(popup)).toBe(true);
  // Share sits above Export; the submenu is to the right of both, from Share's top edge down. Moving down and
  // right onto Export heads for the submenu.
  // (Not for long: resting on Export opens its own submenu after its delay, which replaces this one.)
  await user.hover(exportItem, { position: { x: 108, y: 2 } });
  await user.hover(exportItem, { position: { x: 114, y: 5 } });
  await frame();
  expect(shown(popup)).toBe(true);
  expect(share.getAttribute("aria-expanded")).toBe("true");
  // Straying left, away from the submenu, closes it.
  await user.hover(exportItem, { position: { x: 60, y: 12 } });
  await user.hover(exportItem, { position: { x: 50, y: 14 } });
  await expect.poll(() => shown(popup)).toBe(false);
});

test("a link item is a menu item that follows its link on Enter and leaves the menu open by default", async () => {
  const m = mount(submenu);
  const { getByRole, getByTestId, user } = m;
  await openShare(m);
  await user.keyboard("{End}");
  const link = getByRole("menuitem", { name: "Docs" });
  expect(link.tagName).toBe("A");
  expect(document.activeElement).toBe(link);
  let clicks = 0;
  link.addEventListener("click", (event) => {
    clicks += 1;
    event.preventDefault();
  });
  await user.keyboard("{Enter}");
  expect(clicks).toBe(1);
  expect(shown(getByTestId("sub-popup"))).toBe(true);
});

test("a disabled submenu trigger doesn't open its submenu on click, hover or keys", async () => {
  const { getByRole, getByTestId, user } = mount(submenu);
  await user.click(getByRole("button", { name: "File" }));
  const archive = getByRole("menuitem", { name: "Archive" });
  const popup = getByTestId("archive-popup");
  expect(archive.getAttribute("aria-disabled")).toBe("true");
  // Playwright won't press an element marked aria-disabled unless forced.
  await user.click(archive, { force: true });
  await user.hover(archive, { force: true });
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(shown(popup)).toBe(false);
  archive.focus();
  await user.keyboard("{ArrowRight}");
  await frame();
  expect(shown(popup)).toBe(false);
  expect(archive.getAttribute("aria-expanded")).toBe("false");
  expect(shown(getByTestId("root-popup"))).toBe(true);
});
