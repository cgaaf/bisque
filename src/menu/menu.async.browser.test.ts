// Menus used as an app would against a slow server (fixtures/async.rx): items that load when the menu opens and are
// replaced by a reload, items whose handlers start a save, a submenu whose items load, controlled owners that agree
// late or guess. The fake server holds every answer until the test releases it.
import { beforeEach, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import { answered, held, release, resetServer, server, waiting } from "../test/slow-server.ts";
import slow from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const shown = (popup: HTMLElement) => popup.matches(":popover-open");
const focused = () => document.activeElement?.textContent;

test("items that load on open: opened from the keyboard, the first item takes focus once they arrive", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(slow);
  const trigger = getByRole("button", { name: "Files" });
  const popup = getByTestId("files-popup");
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(waiting()).toEqual(["files"]);
  expect(shown(popup)).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(getByTestId("loading").textContent).toBe("Loading…");
  await expect.poll(() => popup.contains(document.activeElement)).toBe(true);
  await held();
  release("files");
  await answered();
  expect(queryByTestId("loading")).toBeNull();
  await expect.poll(focused).toBe("files one");
  expect(document.activeElement!.hasAttribute("data-highlighted")).toBe(true);
  await user.keyboard("{ArrowDown}");
  expect(focused()).toBe("files two");
  await user.keyboard("{Enter}");
  expect(shown(popup)).toBe(false);
  expect(getByTestId("chosen").textContent).toBe("files two");
});

test("items replaced by a new answer: no crash, labels follow, and focus stays in the menu", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const popup = getByTestId("files-popup");
  getByRole("button", { name: "Files" }).focus();
  await user.keyboard("{Enter}");
  await held();
  release("files");
  await answered();
  server.lists = { files: ["alpha", "beta"] };
  const reload = getByRole("menuitem", { name: "Reload" });
  reload.focus();
  await user.keyboard("{Enter}");
  release("files");
  await answered();
  const labels = [...popup.querySelectorAll("[role=group]")].map(
    (group) => document.getElementById(group.getAttribute("aria-labelledby") ?? "")?.textContent,
  );
  expect(labels).toEqual(["Group alpha", "Group beta"]);
  expect(shown(popup)).toBe(true);
  expect(popup.contains(document.activeElement)).toBe(true);
  await user.keyboard("{Home}");
  expect(focused()).toBe("alpha");
});

test("a failure shows in the open menu, which stays closable, and a retry replaces it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(slow);
  server.failing = ["files"];
  const popup = getByTestId("files-popup");
  getByRole("button", { name: "Files" }).focus();
  await user.keyboard("{Enter}");
  await held();
  release("files");
  await answered();
  expect(getByTestId("error").textContent).toBe("Request failed: files");
  expect(shown(popup)).toBe(true);
  // The Retry item is the only item: it takes focus as the first item.
  await expect.poll(focused).toBe("Retry");
  server.failing = [];
  await user.keyboard("{Enter}");
  release("files");
  await answered();
  expect(queryByTestId("error")).toBeNull();
  expect(shown(popup)).toBe(true);
  expect(popup.contains(document.activeElement)).toBe(true);
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
});

test("closes at once while its items are loading", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const popup = getByTestId("files-popup");
  await user.click(getByRole("button", { name: "Files" }));
  await held();
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
  release("files");
  await answered();
  expect(shown(popup)).toBe(false);
});

test("an onOpenChange that awaits doesn't hold the menu", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const trigger = getByRole("button", { name: "Edit" });
  const popup = getByTestId("edit-popup");
  await user.click(trigger);
  await frame();
  expect(waiting()).toEqual(["opened"]);
  expect(shown(popup)).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  await user.keyboard("{Escape}");
  await frame();
  expect(shown(popup)).toBe(false);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("an item whose click starts a save closes the menu at once", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const popup = getByTestId("edit-popup");
  await user.click(getByRole("button", { name: "Edit" }));
  release("opened");
  await user.click(getByRole("menuitem", { name: "Save draft" }));
  await frame();
  expect(shown(popup)).toBe(false);
  expect(waiting()).toEqual(["draft", "closed"]);
  // The save the click started and the close's log both answer; the fixture shows nothing while either is out.
  release("draft");
  release("closed");
  await answered();
  expect(getByTestId("saved").textContent).toBe("closed");
});

test("a checkbox and a radio item whose handlers save change at once, and the menu stays live", async () => {
  const { getByRole, user } = mount(slow);
  await user.click(getByRole("button", { name: "Edit" }));
  release("opened");
  const wrap = getByRole("menuitemcheckbox", { name: "Wrap" });
  await user.click(wrap);
  expect(waiting()).toEqual(["wrap on"]);
  expect(wrap.getAttribute("aria-checked")).toBe("true");
  const byDate = getByRole("menuitemradio", { name: "By date" });
  await user.click(byDate);
  expect(byDate.getAttribute("aria-checked")).toBe("true");
  // Highlight follows the keyboard while both saves are out.
  await user.keyboard("{ArrowUp}");
  expect(focused()).toBe("By name");
  expect(document.activeElement!.hasAttribute("data-highlighted")).toBe(true);
});

test("a submenu whose items load opens at once, and its first item takes focus when they arrive", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  await user.click(getByRole("button", { name: "Edit" }));
  release("opened");
  const recent = getByRole("menuitem", { name: "Recent" });
  recent.focus();
  await user.keyboard("{ArrowRight}");
  const popup = getByTestId("recent-popup");
  expect(waiting()).toEqual(["recent opened", "recent"]);
  expect(shown(popup)).toBe(true);
  expect(recent.getAttribute("aria-expanded")).toBe("true");
  await held();
  // The handler's save is still out: the submenu doesn't wait for it.
  release("recent");
  await answered();
  await expect.poll(focused).toBe("recent one");
  await user.keyboard("{ArrowLeft}");
  expect(shown(popup)).toBe(false);
  expect(document.activeElement).toBe(recent);
});

test("a controlled menu whose owner agrees late follows the owner, both ways", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const trigger = getByRole("button", { name: "Late" });
  const popup = getByTestId("late-popup");
  await user.click(trigger);
  await frame();
  expect(waiting()).toEqual(["open late"]);
  expect(shown(popup)).toBe(false);
  release("open late");
  await answered();
  expect(shown(popup)).toBe(true);
  await user.click(trigger);
  await frame();
  expect(shown(popup)).toBe(true);
  release("close late");
  await answered();
  expect(shown(popup)).toBe(false);
  expect(server.calls).toEqual(["open late", "close late"]);
});

test("a controlled menu whose owner guesses opens and closes at once, with one request each way", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const trigger = getByRole("button", { name: "Pinned" });
  const popup = getByTestId("pinned-popup");
  await user.click(trigger);
  await frame();
  expect(shown(popup)).toBe(true);
  release("pin");
  await answered();
  await user.keyboard("{Escape}");
  await frame();
  expect(shown(popup)).toBe(false);
  await answered();
  expect(server.calls).toEqual(["pin", "unpin"]);
  release("unpin");
  await answered();
  expect(shown(popup)).toBe(false);
});

test("a controlled menu whose owner guesses reopens when the guess reverts", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const trigger = getByRole("button", { name: "Pinned" });
  const popup = getByTestId("pinned-popup");
  await user.click(trigger);
  release("pin");
  await answered();
  server.failing = ["unpin"];
  await user.click(trigger);
  await frame();
  expect(shown(popup)).toBe(false);
  release("unpin");
  await answered();
  expect(shown(popup)).toBe(true);
  expect(server.calls).toEqual(["pin", "unpin"]);
});
