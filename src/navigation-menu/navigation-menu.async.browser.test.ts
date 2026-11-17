// A navigation menu used as an app would against a slow server (fixtures/async.rx): panels whose links load the
// first time they open, a failure and a retry, and an `onValueChange` that is an action.
import { beforeEach, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { frame, mount } from "../test/browser.ts";
import { answered, held, release, resetServer, server, waiting } from "../test/slow-server.ts";
import slow from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const shown = (content: HTMLElement) => content.matches(":popover-open");
const focused = () => document.activeElement?.textContent;

beforeEach(async () => {
  // The pointer stays where the last test left it: on a trigger, it would open that item by hovering.
  await userEvent.hover(document.body, { position: { x: 400, y: 600 } });
});

test("a panel whose links load opens at once on click, and shows them when they arrive", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(slow);
  const trigger = getByRole("button", { name: "Products" });
  const content = getByTestId("products-content");
  await user.click(trigger);
  await frame();
  expect(waiting()).toEqual(["products"]);
  expect(shown(content)).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(getByTestId("products-loading").textContent).toBe("Loading…");
  await held();
  release("products");
  await answered();
  expect(queryByTestId("products-loading")).toBeNull();
  expect(getByRole("link", { name: "products one" })).toBeTruthy();
  expect(shown(content)).toBe(true);
});

test("opened from the keyboard, focus goes to the first link once the links arrive", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const trigger = getByRole("button", { name: "Products" });
  const content = getByTestId("products-content");
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  await expect.poll(() => shown(content)).toBe(true);
  await held();
  release("products");
  await answered();
  await expect.poll(focused).toBe("products one");
  // Escape closes it and focus goes back to the trigger.
  await user.keyboard("{Escape}");
  await frame();
  expect(shown(content)).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

test("moving to another panel while the first is loading shows each panel's own answer", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  await user.click(getByRole("button", { name: "Products" }));
  await held();
  await user.click(getByRole("button", { name: "Docs" }));
  await frame();
  expect(shown(getByTestId("products-content"))).toBe(false);
  expect(shown(getByTestId("docs-content"))).toBe(true);
  expect(getByTestId("docs-loading")).toBeTruthy();
  release("products");
  await held();
  release("docs");
  await answered();
  expect(getByRole("link", { name: "docs one" })).toBeTruthy();
  expect(shown(getByTestId("docs-content"))).toBe(true);
});

test("a failure shows in the open panel, which stays closable, and a retry replaces it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(slow);
  server.failing = ["products"];
  const trigger = getByRole("button", { name: "Products" });
  const content = getByTestId("products-content");
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  await held();
  release("products");
  await answered();
  expect(getByTestId("products-error").textContent).toBe("Request failed: products");
  expect(shown(content)).toBe(true);
  // The first focusable thing to arrive, the Retry button, takes focus.
  expect(document.activeElement).toBe(getByRole("button", { name: "Retry" }));
  server.failing = [];
  const retry = getByRole("button", { name: "Retry" });
  retry.focus();
  await user.keyboard("{Enter}");
  release("products");
  await answered();
  expect(queryByTestId("products-error")).toBeNull();
  // Retry, which had focus, is gone: focus stays in the panel.
  expect(content.contains(document.activeElement)).toBe(true);
  expect(shown(content)).toBe(true);
  await user.keyboard("{Escape}");
  await frame();
  expect(shown(content)).toBe(false);
});

test("an onValueChange that awaits doesn't hold the menu", async () => {
  const { getByRole, getByTestId, user } = mount(slow);
  const trigger = getByRole("button", { name: "About" });
  const content = getByTestId("about-content");
  await user.click(trigger);
  await frame();
  expect(waiting()).toEqual(["about"]);
  expect(shown(content)).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  await user.click(trigger);
  await frame();
  expect(shown(content)).toBe(false);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  release("about");
  release("closed");
  await answered();
  expect(getByTestId("visited").textContent).toBe("closed");
});
