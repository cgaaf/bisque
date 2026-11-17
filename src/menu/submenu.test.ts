import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { flush, mount } from "../test/mount.ts";
import submenu from "./fixtures/submenu.rx";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Fake timers for the hover delays; animation frames stay real so a closed popup can unmount. */
function fakeTimers() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

function advance(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

async function openRootWithKeyboard(
  getByRole: ReturnType<typeof mount>["getByRole"],
  user: ReturnType<typeof mount>["user"],
) {
  getByRole("button", { name: "File" }).focus();
  await user.keyboard("{ArrowDown}");
}

test("the submenu trigger is an item of the parent menu, wired as a popup button", async () => {
  const { getByRole, queryByTestId, user } = mount(submenu);
  await openRootWithKeyboard(getByRole, user);
  const share = getByRole("menuitem", { name: "Share" });
  expect(share.getAttribute("aria-haspopup")).toBe("menu");
  expect(share.getAttribute("aria-expanded")).toBe("false");
  expect(queryByTestId("sub-popup")).toBeNull();
  // Arrow keys in the parent menu reach the submenu trigger, and skip the submenu's items.
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(share);
  expect(share.hasAttribute("data-highlighted")).toBe(true);
  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Print" }));
});

test("ArrowRight opens the submenu on its first item; ArrowLeft closes it back to the trigger", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(submenu);
  await openRootWithKeyboard(getByRole, user);
  await user.keyboard("{ArrowDown}");
  const share = getByRole("menuitem", { name: "Share" });
  await user.keyboard("{ArrowRight}");
  const popup = getByTestId("sub-popup");
  expect(share.getAttribute("aria-expanded")).toBe("true");
  expect(share.getAttribute("aria-controls")).toBe(popup.id);
  expect(share.hasAttribute("data-popup-open")).toBe(true);
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Email" }));
  expect(getByTestId("sub-positioner").getAttribute("data-side")).toBe("right");

  // Arrow keys stay inside the submenu.
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("menuitemcheckbox", { name: "Notify" }));

  await user.keyboard("{ArrowLeft}");
  await expect.poll(() => queryByTestId("sub-popup")).toBeNull();
  expect(document.activeElement).toBe(share);
  expect(getByTestId("root-popup")).toBeTruthy();
});

test("Enter and Space on the trigger open the submenu too", async () => {
  const { getByRole, queryByTestId, user } = mount(submenu);
  await openRootWithKeyboard(getByRole, user);
  await user.keyboard("{ArrowDown}{Enter}");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Email" }));
  await user.keyboard("{ArrowLeft}");
  await expect.poll(() => queryByTestId("sub-popup")).toBeNull();
  await user.keyboard(" ");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Email" }));
});

test("choosing a submenu item closes the whole tree and returns focus to the root trigger", async () => {
  const { getByRole, getByTestId, queryByRole, user } = mount(submenu);
  const trigger = getByRole("button", { name: "File" });
  await openRootWithKeyboard(getByRole, user);
  await user.keyboard("{ArrowDown}{ArrowRight}{Enter}");
  expect(getByTestId("chosen").textContent).toBe("email");
  await expect.poll(() => queryByRole("menu")).toBeNull();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);
});

test("a checkbox item in the submenu keeps the tree open", async () => {
  const { getByRole, getByTestId, user } = mount(submenu);
  await openRootWithKeyboard(getByRole, user);
  await user.keyboard("{ArrowDown}{ArrowRight}");
  await user.click(getByRole("menuitemcheckbox", { name: "Notify" }));
  expect(getByTestId("wrap").textContent).toBe("on");
  expect(getByTestId("sub-popup")).toBeTruthy();
  expect(getByTestId("root-popup")).toBeTruthy();
});

test("Escape closes the whole tree by default", async () => {
  const { getByRole, queryByRole, user } = mount(submenu);
  const trigger = getByRole("button", { name: "File" });
  await openRootWithKeyboard(getByRole, user);
  await user.keyboard("{ArrowDown}{ArrowRight}");
  await user.keyboard("{Escape}");
  await expect.poll(() => queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test("closeParentOnEsc={false}: Escape closes only the submenu", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(submenu);
  await openRootWithKeyboard(getByRole, user);
  await user.keyboard("{ArrowDown}{ArrowDown}");
  const exportTrigger = getByRole("menuitem", { name: "Export" });
  expect(document.activeElement).toBe(exportTrigger);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "PDF" }));
  await user.keyboard("{Escape}");
  await expect.poll(() => queryByTestId("export-popup")).toBeNull();
  expect(getByTestId("root-popup")).toBeTruthy();
  expect(document.activeElement).toBe(exportTrigger);
});

test("a press outside closes the whole tree; a press in the parent menu doesn't", async () => {
  const { getByRole, getByTestId, queryByRole, user } = mount(submenu);
  await openRootWithKeyboard(getByRole, user);
  await user.keyboard("{ArrowDown}{ArrowRight}");
  // Inside the parent popup but on no item: the tree stays open.
  await user.pointer({ keys: "[MouseLeft]", target: getByTestId("root-popup") });
  expect(getByTestId("sub-popup")).toBeTruthy();
  await user.click(getByTestId("outside"));
  await expect.poll(() => queryByRole("menu")).toBeNull();
});

test("Tab in the submenu closes the whole tree", async () => {
  const { getByRole, queryByRole, user } = mount(submenu);
  await openRootWithKeyboard(getByRole, user);
  await user.keyboard("{ArrowDown}{ArrowRight}");
  await user.tab();
  await expect.poll(() => queryByRole("menu")).toBeNull();
});

test("hovering the trigger opens the submenu after the delay, without moving focus into it", async () => {
  const user = fakeTimers();
  const { getByRole, getByTestId, queryByTestId } = mount(submenu);
  await user.click(getByRole("button", { name: "File" }));
  const share = getByRole("menuitem", { name: "Share" });
  await user.hover(share);
  expect(document.activeElement).toBe(share);
  advance(99);
  expect(queryByTestId("sub-popup")).toBeNull();
  advance(1);
  expect(getByTestId("sub-popup")).toBeTruthy();
  expect(document.activeElement).toBe(share);

  // ArrowRight on a hover-opened submenu moves focus into it.
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Email" }));
});

test("leaving the trigger for another item closes the submenu; ArrowDown on the trigger does too", async () => {
  const user = fakeTimers();
  const { getByRole, queryByTestId, getByTestId } = mount(submenu);
  await user.click(getByRole("button", { name: "File" }));
  const share = getByRole("menuitem", { name: "Share" });
  await user.hover(share);
  advance(100);
  expect(getByTestId("sub-popup")).toBeTruthy();
  await user.hover(getByRole("menuitem", { name: "Print" }));
  advance(0);
  expect(share.getAttribute("aria-expanded")).toBe("false");

  await user.hover(share);
  advance(100);
  expect(share.getAttribute("aria-expanded")).toBe("true");
  share.focus();
  await user.keyboard("{ArrowDown}");
  expect(share.getAttribute("aria-expanded")).toBe("false");
  vi.useRealTimers();
  await expect.poll(() => queryByTestId("sub-popup")).toBeNull();
});

test("crossing another item on the way to the submenu keeps it open (safe area)", async () => {
  const user = fakeTimers();
  const { getByRole, getByTestId } = mount(submenu);
  await user.click(getByRole("button", { name: "File" }));
  const share = getByRole("menuitem", { name: "Share" });
  await user.hover(share);
  advance(100);
  const popup = getByTestId("sub-popup");
  const exportTrigger = getByRole("menuitem", { name: "Export" });
  // The trigger at the left, the submenu to its right and lower down, the Export item under the trigger.
  vi.spyOn(share, "getBoundingClientRect").mockReturnValue(rect(0, 100, 100, 20));
  vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(rect(100, 100, 100, 100));
  vi.spyOn(exportTrigger, "getBoundingClientRect").mockReturnValue(rect(0, 120, 100, 20));

  await user.pointer([
    { target: share, coords: { clientX: 90, clientY: 118 } },
    { target: exportTrigger, coords: { clientX: 95, clientY: 125 } },
  ]);
  advance(0);
  expect(share.getAttribute("aria-expanded")).toBe("true");
  // Straying away from the submenu closes it.
  await user.pointer({ target: exportTrigger, coords: { clientX: 5, clientY: 135 } });
  advance(0);
  expect(share.getAttribute("aria-expanded")).toBe("false");
});

test("the arrow is positioned against the trigger", async () => {
  const { getByRole, getByTestId, user } = mount(submenu);
  await user.click(getByRole("button", { name: "File" }));
  const arrow = getByTestId("arrow");
  expect(arrow.getAttribute("aria-hidden")).toBe("true");
  await expect.poll(() => arrow.getAttribute("data-side")).toBe("bottom");
  expect(arrow.style.position).toBe("absolute");
});

test("a link item is a menu item that follows its link on Enter and leaves the menu open by default", async () => {
  const { getByRole, getByTestId, user } = mount(submenu);
  await openRootWithKeyboard(getByRole, user);
  await user.keyboard("{ArrowDown}{ArrowRight}{End}");
  const link = getByRole("menuitem", { name: "Docs" });
  expect(link.tagName).toBe("A");
  expect(document.activeElement).toBe(link);
  const clicked = vi.fn<(event: Event) => void>((event) => event.preventDefault());
  link.addEventListener("click", clicked);
  await user.keyboard("{Enter}");
  expect(clicked).toHaveBeenCalledTimes(1);
  expect(getByTestId("sub-popup")).toBeTruthy();
});
