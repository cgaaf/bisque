// Popovers used as an app would against a slow server (fixtures/async.rx): content that loads when the popover
// opens, an `onOpenChange` that is itself an action, a controlled owner that agrees late or guesses. The fake server
// holds every answer until the test releases it.
import { beforeEach, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import { answered, held, release, resetServer, server, waiting } from "../test/slow-server.ts";
import slow from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const shown = (popup: HTMLElement) => popup.matches(":popover-open");

test("content that loads on open: the popover opens at once, and focus stays in it when the content arrives", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(slow);
  const trigger = getByRole("button", { name: "Profile" });
  const popup = getByTestId("profile");
  await user.click(trigger);
  expect(waiting()).toEqual(["profile"]);
  expect(shown(popup)).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(getByTestId("loading").textContent).toBe("Loading…");
  getByRole("button", { name: "Close profile" }).focus();
  await held();
  release("profile");
  await answered();
  expect(queryByTestId("loading")).toBeNull();
  expect(getByTestId("details").textContent).toBe("Details of profile");
  expect(shown(popup)).toBe(true);
  expect(popup.contains(document.activeElement)).toBe(true);
});

test("a failure shows in the open popover, which stays closable, and a retry replaces it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(slow);
  server.failing = ["profile"];
  const popup = getByTestId("profile");
  await user.click(getByRole("button", { name: "Profile" }));
  await held();
  release("profile");
  await answered();
  expect(getByTestId("error").textContent).toBe("Request failed: profile");
  expect(shown(popup)).toBe(true);
  server.failing = [];
  const retry = getByRole("button", { name: "Retry" });
  retry.focus();
  await user.keyboard("{Enter}");
  release("profile");
  await answered();
  expect(queryByTestId("error")).toBeNull();
  expect(getByTestId("details").textContent).toBe("Details of profile");
  // The Retry button that had focus is gone: focus stays in the popover.
  expect(popup.contains(document.activeElement)).toBe(true);
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
});

test("closes at once while its content is loading", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const popup = getByTestId("profile");
  await user.click(getByRole("button", { name: "Profile" }));
  await held();
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
  release("profile");
  await answered();
  expect(shown(popup)).toBe(false);
});

test("an onOpenChange that awaits doesn't hold the popover, or put it out of step with its element", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const trigger = getByRole("button", { name: "Logged" });
  const popup = getByTestId("logged-popup");
  await user.click(trigger);
  await frame();
  expect(waiting()).toEqual(["opened"]);
  expect(shown(popup)).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  await user.keyboard("{Escape}");
  await frame();
  expect(shown(popup)).toBe(false);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  release("opened");
  release("closed");
  await answered();
  expect(getByTestId("logged").textContent).toBe("closed");
  expect(shown(popup)).toBe(false);
});

test("a controlled popover whose owner agrees late follows the owner, both ways", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const trigger = getByRole("button", { name: "Late" });
  const popup = getByTestId("late-popup");
  await user.click(trigger);
  await frame();
  expect(waiting()).toEqual(["open late"]);
  expect(shown(popup)).toBe(false);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  release("open late");
  await answered();
  expect(shown(popup)).toBe(true);
  await user.click(getByRole("button", { name: "Close late" }));
  await frame();
  expect(shown(popup)).toBe(true);
  release("close late");
  await answered();
  expect(shown(popup)).toBe(false);
  expect(server.calls).toEqual(["open late", "close late"]);
});

test("a controlled popover whose owner guesses opens and closes at once, with one request each way", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const trigger = getByRole("button", { name: "Pinned" });
  const popup = getByTestId("pinned-popup");
  await user.click(trigger);
  await frame();
  expect(shown(popup)).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  release("pin");
  await answered();
  expect(shown(popup)).toBe(true);
  await user.click(getByRole("button", { name: "Close pinned" }));
  await frame();
  expect(shown(popup)).toBe(false);
  await answered();
  expect(server.calls).toEqual(["pin", "unpin"]);
  release("unpin");
  await answered();
  expect(shown(popup)).toBe(false);
});

test("a controlled popover whose owner guesses reopens when the guess reverts", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const popup = getByTestId("pinned-popup");
  await user.click(getByRole("button", { name: "Pinned" }));
  release("pin");
  await answered();
  server.failing = ["unpin"];
  await user.click(getByRole("button", { name: "Close pinned" }));
  await frame();
  expect(shown(popup)).toBe(false);
  release("unpin");
  await answered();
  expect(shown(popup)).toBe(true);
  expect(server.calls).toEqual(["pin", "unpin"]);
});
