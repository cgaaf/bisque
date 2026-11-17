// Accordions used as an app would against a slow server (fixtures/async.rx): an item whose content loads when it
// opens, content that fails and is retried, an item's `onOpenChange` that is itself an action, a controlled owner
// that agrees late or guesses. The fake server holds every answer until the test releases it.
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

test("an item whose content loads opens at once, and the browser's one-open rule stays in step", async () => {
  const { getByTestId, getByText, user } = mount(slow);
  const shipping = details(getByTestId("item-shipping"));
  const returns = details(getByTestId("item-returns"));
  await user.click(summary(getByText, "Shipping"));
  expect(waiting()).toEqual(["shipping"]);
  expect(shipping.open).toBe(true);
  expect(getByTestId("loading").textContent).toBe("loading");
  await user.click(summary(getByText, "Returns"));
  expect(returns.open).toBe(true);
  await expect.poll(() => shipping.open).toBe(false);
  release("shipping");
  release("returns");
  await answered();
  expect(getByTestId("panel-returns").textContent).toBe("Details of returns");
  expect(returns.open).toBe(true);
  expect(shipping.open).toBe(false);
});

test("content that fails shows its error in the open item, and a retry replaces it; focus stays in the panel", async () => {
  const { getByRole, getByTestId, getByText, queryByTestId, user } = mount(slow);
  server.failing = ["faq"];
  const faq = details(getByTestId("item-faq"));
  await user.click(summary(getByText, "FAQ"));
  expect(faq.open).toBe(true);
  expect(getByTestId("faq-loading")).toBeTruthy();
  await held();
  release("faq");
  await answered();
  expect(getByTestId("faq-error").textContent).toBe("Request failed: faq");
  server.failing = [];
  getByRole("button", { name: "Retry" }).focus();
  await user.keyboard("{Enter}");
  release("faq");
  await answered();
  expect(queryByTestId("faq-error")).toBeNull();
  expect(getByTestId("faq-text").textContent).toBe("Details of faq");
  expect(getByTestId("panel-faq").contains(document.activeElement)).toBe(true);
});

test("an item onOpenChange that awaits doesn't hold the item, nor fight the browser opening it", async () => {
  const { getByTestId, getByText, user } = mount(slow);
  const item = details(getByTestId("item-logged"));
  await user.click(summary(getByText, "Logged"));
  expect(waiting()).toEqual(["opened"]);
  expect(item.open).toBe(true);
  await user.click(summary(getByText, "Logged"));
  await expect.poll(() => item.open).toBe(false);
  // Opened by the browser itself (find-in-page).
  item.open = true;
  await expect.poll(() => waiting()).toEqual(["opened", "closed", "opened"]);
  await answered();
  expect(item.open).toBe(true);
  release("opened");
  release("closed");
  release("opened");
  await answered();
  expect(item.open).toBe(true);
  expect(getByTestId("logged").textContent).toBe("opened");
});

test("a controlled accordion whose owner agrees late follows the owner", async () => {
  const { getByTestId, getByText, user } = mount(slow);
  const item = details(getByTestId("late-a"));
  await user.click(summary(getByText, "Late A"));
  expect(waiting()).toEqual(["late a"]);
  expect(item.open).toBe(false);
  release("late a");
  await answered();
  expect(item.open).toBe(true);
  server.failing = ["late "];
  await user.click(summary(getByText, "Late A"));
  release("late ");
  await answered();
  expect(item.open).toBe(true);
});

test("a controlled accordion whose owner guesses opens at once, with one request", async () => {
  const { getByTestId, getByText, user } = mount(slow);
  const item = details(getByTestId("guess-a"));
  await user.click(summary(getByText, "Guess A"));
  expect(item.open).toBe(true);
  release("guess a");
  await answered();
  expect(item.open).toBe(true);
  expect(server.calls).toEqual(["guess a"]);
});

test("a controlled accordion whose owner guesses closes the item again when the guess reverts", async () => {
  const { getByTestId, getByText, user } = mount(slow);
  server.failing = ["guess a"];
  const item = details(getByTestId("guess-a"));
  await user.click(summary(getByText, "Guess A"));
  expect(item.open).toBe(true);
  release("guess a");
  await answered();
  await expect.poll(() => item.open).toBe(false);
  expect(server.calls).toEqual(["guess a"]);
});
