// Preview cards used as an app would against a slow server (fixtures/async.rx): a preview that loads when the card
// opens, fails and is retried, and an `onOpenChange` that is itself an action.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, held, release, releaseAll, resetServer, server, waiting } from "../test/slow-server.ts";
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

test("a preview that loads on open: the card opens at once, then shows the preview", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = await start();
  const popup = getByTestId("popup");
  await user.hover(getByRole("link", { name: "Typography" }));
  await expect.poll(() => shown(popup)).toBe(true);
  expect(waiting()).toEqual(["typography"]);
  expect(getByTestId("loading").textContent).toBe("Loading…");
  await held();
  release("typography");
  await answered();
  expect(queryByTestId("loading")).toBeNull();
  expect(getByTestId("preview").textContent).toBe("Details of typography");
  expect(shown(popup)).toBe(true);
});

test("a failed preview shows in the card, and a retry from the keyboard keeps focus in it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = await start();
  server.failing = ["typography"];
  const popup = getByTestId("popup");
  await user.hover(getByRole("link", { name: "Typography" }));
  await expect.poll(() => shown(popup)).toBe(true);
  await held();
  release("typography");
  await answered();
  expect(getByTestId("error").textContent).toBe("Request failed: typography");
  server.failing = [];
  getByRole("button", { name: "Retry" }).focus();
  await user.keyboard("{Enter}");
  release("typography");
  await answered();
  expect(queryByTestId("error")).toBeNull();
  expect(getByTestId("preview").textContent).toBe("Details of typography");
  expect(popup.contains(document.activeElement)).toBe(true);
  expect(shown(popup)).toBe(true);
});

test("an onOpenChange that awaits doesn't hold the card", async () => {
  const { getByRole, getByTestId, user } = await start();
  const popup = getByTestId("logged-popup");
  await user.hover(getByRole("link", { name: "Logged" }));
  await expect.poll(() => shown(popup)).toBe(true);
  // The pointer may cross the other link on its way: only this card's request matters here.
  expect(waiting()).toContain("opened");
  await user.keyboard("{Escape}");
  await expect.poll(() => shown(popup)).toBe(false);
  releaseAll();
  await answered();
  expect(getByTestId("logged").textContent).toBe("closed");
  expect(shown(popup)).toBe(false);
});
