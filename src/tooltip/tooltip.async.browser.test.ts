// Tooltips used as an app would against a slow server (fixtures/async.rx): text that loads when the tooltip opens,
// a request that fails, and an `onOpenChange` that is itself an action.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, releaseAll, resetServer, server, waiting } from "../test/slow-server.ts";
import slow from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const shown = (popup: HTMLElement) => popup.matches(":popover-open");

async function start() {
  const mounted = mount(slow);
  await mounted.user.hover(mounted.getByTestId("outside"));
  return mounted;
}

test("text that loads on open: the tooltip opens at once, then shows it", async () => {
  const { getByRole, getByTestId, user } = await start();
  const popup = getByTestId("popup");
  await user.hover(getByRole("button", { name: "Save" }));
  await expect.poll(() => shown(popup)).toBe(true);
  expect(waiting()).toEqual(["shortcut"]);
  expect(popup.textContent).toBe("…");
  release("shortcut");
  await answered();
  expect(popup.textContent).toBe("Details of shortcut");
  expect(shown(popup)).toBe(true);
});

test("text that fails to load: the tooltip stays open and says so", async () => {
  const { getByRole, getByTestId, user } = await start();
  server.failing = ["shortcut"];
  const popup = getByTestId("popup");
  await user.hover(getByRole("button", { name: "Save" }));
  await expect.poll(() => shown(popup)).toBe(true);
  release("shortcut");
  await answered();
  expect(popup.textContent).toBe("No hint");
  expect(shown(popup)).toBe(true);
});

test("an onOpenChange that awaits doesn't hold the tooltip", async () => {
  const { getByRole, getByTestId, user } = await start();
  const popup = getByTestId("logged-popup");
  await user.hover(getByRole("button", { name: "Logged" }));
  await expect.poll(() => shown(popup)).toBe(true);
  expect(waiting()).toContain("opened");
  await user.hover(getByTestId("outside"));
  await expect.poll(() => shown(popup)).toBe(false);
  releaseAll();
  await answered();
  expect(getByTestId("logged").textContent).toBe("closed");
  expect(shown(popup)).toBe(false);
});
