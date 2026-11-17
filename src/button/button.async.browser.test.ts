// Buttons whose press starts a request (fixtures/async.rx), disabled by `pending?` while it is out. The fake
// server holds every save until the test answers it.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, refuse, release, resetServer, server, waiting } from "../test/settings-server.ts";
import fixture from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

async function setup() {
  const mounted = mount(fixture);
  await answered();
  const button = (name: string) => mounted.getByRole("button", { name }) as HTMLButtonElement;
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, button, text };
}

test("disabled by pending?: a second press while the request is out sends nothing", async () => {
  const { button, text, user } = await setup();
  const save = button("Save");
  save.focus();
  await user.keyboard("{Enter}");
  expect(waiting()).toEqual([1]);
  expect(save.disabled).toBe(true);
  expect(save.hasAttribute("data-disabled")).toBe(true);
  await user.keyboard("{Enter}");
  save.click();
  expect(waiting()).toEqual([1]);
  release(1);
  await answered();
  expect(save.disabled).toBe(false);
  expect(text("saves")).toBe("1");
});

test("disabled by pending?: takes focus back when the request ends, and presses again", async () => {
  const { button, text, user } = await setup();
  const save = button("Save");
  save.focus();
  await user.keyboard("{Enter}");
  release(1);
  await answered();
  expect(document.activeElement).toBe(save);
  await user.keyboard("{Enter}");
  expect(waiting()).toEqual([2]);
  refuse(2);
  await answered();
  expect(save.disabled).toBe(false);
  expect(document.activeElement).toBe(save);
  expect(text("saves")).toBe("1");
});

test("focusableWhenDisabled with pending?: keeps focus throughout and ignores presses", async () => {
  const { button, text, user } = await setup();
  const send = button("Send");
  send.focus();
  await user.keyboard("{Enter}");
  expect(waiting()).toEqual([1]);
  expect(send.getAttribute("aria-disabled")).toBe("true");
  expect(send.disabled).toBe(false);
  expect(document.activeElement).toBe(send);
  await user.keyboard("{Enter}");
  await user.keyboard(" ");
  send.click();
  expect(waiting()).toEqual([1]);
  release(1);
  await answered();
  expect(send.hasAttribute("aria-disabled")).toBe(false);
  expect(document.activeElement).toBe(send);
  expect(text("sends")).toBe("1");
});

test("without disabled, a second press sends again", async () => {
  const { button, user } = await setup();
  const plain = button("Plain");
  plain.focus();
  await user.keyboard("{Enter}");
  await user.keyboard("{Enter}");
  expect(waiting()).toEqual([0, 1]);
});

test("the fixture's comments aren't rendered", async () => {
  const { container } = await setup();
  expect(container.textContent).not.toContain("request");
});
