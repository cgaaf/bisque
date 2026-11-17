// Collapsibles used as an app would against a slow server (fixtures/async.rx): content that loads when it opens,
// content that fails and is retried, an `onOpenChange` that is itself an action, a controlled owner that agrees late
// or guesses. The fake server holds every answer until the test releases it.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, held, release, resetServer, server, waiting } from "../test/slow-server.ts";
import slow from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const details = (el: HTMLElement) => el as HTMLDetailsElement;
const summary = (getByText: (text: string) => HTMLElement, text: string) =>
  getByText(text).closest("summary")!;

test("content that loads on open: it opens at once and shows the old content until the answer", async () => {
  const { getByTestId, getByText, user } = mount(slow);
  const root = details(getByTestId("notes"));
  await user.click(summary(getByText, "Notes"));
  expect(waiting()).toEqual(["notes"]);
  expect(root.open).toBe(true);
  expect(getByTestId("notes-loading").textContent).toBe("loading");
  release("notes");
  await answered();
  expect(getByTestId("notes-panel").textContent).toBe("Details of notes");
  expect(root.open).toBe(true);
});

test("content that fails shows its error in the open panel, and a retry replaces it; focus stays in the panel", async () => {
  const { getByRole, getByTestId, getByText, queryByTestId, user } = mount(slow);
  server.failing = ["history"];
  const root = details(getByTestId("history"));
  await user.click(summary(getByText, "History"));
  expect(root.open).toBe(true);
  expect(getByTestId("history-loading")).toBeTruthy();
  await held();
  release("history");
  await answered();
  expect(getByTestId("history-error").textContent).toBe("Request failed: history");
  server.failing = [];
  getByRole("button", { name: "Retry" }).focus();
  await user.keyboard("{Enter}");
  release("history");
  await answered();
  expect(queryByTestId("history-error")).toBeNull();
  expect(getByTestId("history-text").textContent).toBe("Details of history");
  expect(getByTestId("history-panel").contains(document.activeElement)).toBe(true);
  expect(root.open).toBe(true);
});

test("an onOpenChange that awaits doesn't hold it", async () => {
  const { getByTestId, getByText, user } = mount(slow);
  const root = details(getByTestId("logged-root"));
  await user.click(summary(getByText, "Logged"));
  expect(waiting()).toEqual(["opened"]);
  expect(root.open).toBe(true);
  await user.click(summary(getByText, "Logged"));
  await expect.poll(() => root.open).toBe(false);
  release("opened");
  release("closed");
  await answered();
  expect(getByTestId("logged").textContent).toBe("closed");
  expect(root.open).toBe(false);
});

test("opened by the browser itself (find-in-page) while onOpenChange awaits: it stays open", async () => {
  const { getByTestId } = mount(slow);
  const root = details(getByTestId("logged-root"));
  // What find-in-page does: the browser opens the <details>, and the component hears of it from `toggle`.
  root.open = true;
  await expect.poll(() => waiting()).toEqual(["opened"]);
  await answered();
  expect(root.open).toBe(true);
  release("opened");
  await answered();
  expect(root.open).toBe(true);
});

test("a controlled collapsible whose owner agrees late follows the owner", async () => {
  const { getByTestId, getByText, user } = mount(slow);
  const root = details(getByTestId("late"));
  await user.click(summary(getByText, "Late"));
  expect(waiting()).toEqual(["open late"]);
  expect(root.open).toBe(false);
  release("open late");
  await answered();
  expect(root.open).toBe(true);
  server.failing = ["close late"];
  await user.click(summary(getByText, "Late"));
  release("close late");
  await answered();
  expect(root.open).toBe(true);
});

test("a controlled collapsible whose owner guesses opens at once, with one request", async () => {
  const { getByTestId, getByText, user } = mount(slow);
  const root = details(getByTestId("guessed"));
  await user.click(summary(getByText, "Guessed"));
  expect(root.open).toBe(true);
  release("guess open");
  await answered();
  expect(root.open).toBe(true);
  expect(server.calls).toEqual(["guess open"]);
});

test("a controlled collapsible whose owner guesses closes again when the guess reverts", async () => {
  const { getByTestId, getByText, user } = mount(slow);
  server.failing = ["guess open"];
  const root = details(getByTestId("guessed"));
  await user.click(summary(getByText, "Guessed"));
  expect(root.open).toBe(true);
  release("guess open");
  await answered();
  await expect.poll(() => root.open).toBe(false);
  expect(server.calls).toEqual(["guess open"]);
});
