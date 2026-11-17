// Dialogs used as an app would against a slow server (fixtures/async.rx): content that loads when the dialog opens,
// a save that closes it, an `onOpenChange` that is itself an action. The fake server holds every answer until the
// test releases it.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, held, release, resetServer, server, waiting } from "../test/slow-server.ts";
import slow from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const isOpen = (dialog: HTMLElement) => (dialog as HTMLDialogElement).open;

test("content that loads on open: the dialog opens at once and shows the loading state", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(slow);
  const trigger = getByRole("button", { name: "Open details" });
  const dialog = getByTestId("details-dialog");
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(waiting()).toEqual(["project"]);
  expect(isOpen(dialog)).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(getByTestId("loading").textContent).toBe("Loading…");
  expect(dialog.contains(document.activeElement)).toBe(true);
  await held();
  release("project");
  await answered();
  expect(queryByTestId("loading")).toBeNull();
  expect(getByTestId("details").textContent).toBe("Details of project");
  expect(isOpen(dialog)).toBe(true);
});

test("a dialog opened with nothing focusable yet moves focus into its content when it arrives", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const dialog = getByTestId("form-dialog");
  getByRole("button", { name: "Open form" }).focus();
  await user.keyboard("{Enter}");
  expect(isOpen(dialog)).toBe(true);
  expect(getByTestId("form-loading")).toBeTruthy();
  await held();
  release("form");
  await answered();
  expect(document.activeElement).toBe(getByRole("textbox", { name: "Title" }));
  await user.keyboard("{Escape}");
  await expect.poll(() => isOpen(dialog)).toBe(false);
});

test("an onOpenChange that awaits doesn't hold the dialog", async () => {
  const { getByRole, getByTestId, getByText, user } = mount(slow);
  const trigger = getByRole("button", { name: "Open logged" });
  const dialog = getByText("Close logged").closest("dialog")!;
  await user.click(trigger);
  expect(waiting()).toEqual(["opened"]);
  expect(isOpen(dialog)).toBe(true);
  await user.click(getByRole("button", { name: "Close logged" }));
  await expect.poll(() => isOpen(dialog)).toBe(false);
  release("opened");
  release("closed");
  await answered();
  expect(getByTestId("logged").textContent).toBe("closed");
  expect(isOpen(dialog)).toBe(false);
});

test("a controlled dialog closed by a save stays open until the server answers", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  await user.click(getByRole("button", { name: "Edit" }));
  const dialog = getByRole("dialog", { name: "Edit" });
  await user.click(getByRole("button", { name: "Save" }));
  expect(waiting()).toEqual(["draft"]);
  expect(isOpen(dialog)).toBe(true);
  release("draft");
  await answered();
  await expect.poll(() => isOpen(dialog)).toBe(false);
  expect(getByTestId("saved").textContent).toBe("draft");
});

test("content that fails: the error shows in the open dialog, which stays closable, and a retry replaces it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(slow);
  server.failing = ["alpha"];
  await user.click(getByRole("button", { name: "Open alpha" }));
  const dialog = getByTestId("row-dialog");
  expect(isOpen(dialog)).toBe(true);
  expect(getByTestId("row-loading")).toBeTruthy();
  await held();
  release("alpha");
  await answered();
  expect(getByTestId("row-error").textContent).toBe("Request failed: alpha");
  expect(isOpen(dialog)).toBe(true);
  server.failing = [];
  await user.click(getByRole("button", { name: "Retry row" }));
  expect(waiting()).toEqual(["alpha"]);
  release("alpha");
  await answered();
  expect(queryByTestId("row-error")).toBeNull();
  expect(getByTestId("row-details").textContent).toBe("Details of alpha");
  expect(isOpen(dialog)).toBe(true);
  await user.keyboard("{Escape}");
  await expect.poll(() => isOpen(dialog)).toBe(false);
});

test("a dialog whose content is loading closes at once, and a stale answer doesn't show in the next one", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  await user.click(getByRole("button", { name: "Open alpha" }));
  const dialog = getByTestId("row-dialog");
  expect(getByTestId("row-loading")).toBeTruthy();
  await held();
  await user.click(getByRole("button", { name: "Close row" }));
  await expect.poll(() => isOpen(dialog)).toBe(false);
  await user.click(getByRole("button", { name: "Open beta" }));
  expect(isOpen(dialog)).toBe(true);
  expect(getByTestId("row-loading")).toBeTruthy();
  await held();
  release("beta");
  await answered();
  expect(getByTestId("row-details").textContent).toBe("Details of beta");
  release("alpha");
  await answered();
  expect(getByTestId("row-details").textContent).toBe("Details of beta");
  expect(dialog.contains(document.activeElement)).toBe(true);
});

test("a controlled dialog whose owner agrees late follows the owner, both ways", async () => {
  const { getByRole, getByText, user } = mount(slow);
  const dialog = getByText("Close late").closest("dialog")!;
  await user.click(getByRole("button", { name: "Open late" }));
  expect(waiting()).toEqual(["open late"]);
  expect(isOpen(dialog)).toBe(false);
  release("open late");
  await answered();
  expect(isOpen(dialog)).toBe(true);
  // Escape asks; the dialog stays open until the owner agrees.
  await user.keyboard("{Escape}");
  expect(waiting()).toEqual(["close late"]);
  await answered();
  expect(isOpen(dialog)).toBe(true);
  release("close late");
  await answered();
  await expect.poll(() => isOpen(dialog)).toBe(false);
  // Refused: the request fails and the owner never writes.
  await user.click(getByRole("button", { name: "Open late" }));
  release("open late");
  await answered();
  server.failing = ["close late"];
  await user.click(getByRole("button", { name: "Close late" }));
  release("close late");
  await answered();
  expect(isOpen(dialog)).toBe(true);
});

test("a controlled dialog whose owner guesses opens and closes at once, with one request each way", async () => {
  const { getByRole, getByText, user } = mount(slow);
  const dialog = getByText("Close pinned").closest("dialog")!;
  await user.click(getByRole("button", { name: "Open pinned" }));
  expect(isOpen(dialog)).toBe(true);
  release("pin");
  await answered();
  await user.click(getByRole("button", { name: "Close pinned" }));
  await expect.poll(() => isOpen(dialog)).toBe(false);
  await answered();
  // The element closing itself under the guess is not a second request to close.
  expect(server.calls).toEqual(["pin", "unpin"]);
  release("unpin");
  await answered();
  expect(isOpen(dialog)).toBe(false);
});

test("a controlled dialog whose owner guesses reopens when the guess reverts", async () => {
  const { getByRole, getByText, user } = mount(slow);
  const dialog = getByText("Close pinned").closest("dialog")!;
  await user.click(getByRole("button", { name: "Open pinned" }));
  expect(waiting()).toEqual(["pin"]);
  expect(isOpen(dialog)).toBe(true);
  release("pin");
  await answered();
  expect(isOpen(dialog)).toBe(true);
  server.failing = ["unpin"];
  await user.click(getByRole("button", { name: "Close pinned" }));
  await expect.poll(() => isOpen(dialog)).toBe(false);
  release("unpin");
  await answered();
  // One request for one close: the element closing itself is not asked about again.
  expect(server.calls).toEqual(["pin", "unpin"]);
  expect(isOpen(dialog)).toBe(true);
});
