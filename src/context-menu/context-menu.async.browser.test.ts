// A context menu used as an app would against a slow server (fixtures/async.rx): actions that load when it opens,
// grouped under labels and replaced by a reload, and a choice that starts a save.
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

test("right-click opens it at once while its actions load", async () => {
  const { getByTestId, queryByTestId, user } = mount(slow);
  const popup = getByTestId("popup");
  await user.click(getByTestId("area"), { button: "right", position: { x: 100, y: 60 } });
  await expect.poll(() => shown(popup)).toBe(true);
  expect(waiting()).toEqual(["actions"]);
  expect(getByTestId("loading").textContent).toBe("Loading…");
  await held();
  release("actions");
  await answered();
  expect(queryByTestId("loading")).toBeNull();
  expect(shown(popup)).toBe(true);
  expect(popup.contains(document.activeElement)).toBe(true);
});

test("opened from the keyboard, the first action takes focus when they arrive; a reload replaces them", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const popup = getByTestId("popup");
  getByRole("textbox", { name: "Field" }).focus();
  await user.keyboard("{Shift>}{F10}{/Shift}");
  await expect.poll(() => shown(popup)).toBe(true);
  await held();
  release("actions");
  await answered();
  await expect.poll(focused).toBe("actions one");
  server.lists = { actions: ["cut", "copy"] };
  getByRole("menuitem", { name: "Reload" }).focus();
  await user.keyboard("{Enter}");
  release("actions");
  await answered();
  const labels = [...popup.querySelectorAll("[role=group]")].map(
    (group) => document.getElementById(group.getAttribute("aria-labelledby") ?? "")?.textContent,
  );
  expect(labels).toEqual(["Group cut", "Group copy"]);
  await user.keyboard("{Home}");
  expect(focused()).toBe("cut");
  await user.keyboard("{Enter}");
  await frame();
  // The choice starts a save, and the menu closes without waiting for it.
  expect(shown(popup)).toBe(false);
  expect(waiting()).toEqual(["cut"]);
  release("cut");
  await answered();
  expect(getByTestId("saved").textContent).toBe("cut");
});
