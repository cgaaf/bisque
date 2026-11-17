// Drawers used as an app would against a slow server (fixtures/async.rx): content that loads when the drawer opens,
// and an `onOpenChange` that is itself an action.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, held, release, resetServer, server, waiting } from "../test/slow-server.ts";
import slow from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const isOpen = (dialog: HTMLElement) => (dialog as HTMLDialogElement).open;

test("content that loads on open: the drawer opens at once and keeps focus", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(slow);
  const drawer = getByTestId("cart");
  getByRole("button", { name: "Cart" }).focus();
  await user.keyboard("{Enter}");
  expect(isOpen(drawer)).toBe(true);
  expect(waiting()).toEqual(["cart"]);
  expect(getByTestId("loading").textContent).toBe("Loading…");
  await held();
  release("cart");
  await answered();
  expect(queryByTestId("loading")).toBeNull();
  expect(getByTestId("details").textContent).toBe("Details of cart");
  expect(drawer.contains(document.activeElement)).toBe(true);
});

test("an onOpenChange that awaits doesn't hold the drawer, either way", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const drawer = getByTestId("logged-drawer");
  await user.click(getByRole("button", { name: "Logged" }));
  expect(isOpen(drawer)).toBe(true);
  expect(waiting()).toEqual(["opened"]);
  await user.keyboard("{Escape}");
  await expect.poll(() => isOpen(drawer)).toBe(false);
  release("opened");
  release("closed");
  await answered();
  expect(getByTestId("logged").textContent).toBe("closed");
  expect(isOpen(drawer)).toBe(false);
});
