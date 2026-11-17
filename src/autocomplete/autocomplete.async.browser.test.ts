// An autocomplete whose suggestions come from a server (fixtures/async.rx): its text is controlled by a source the
// server's question reads, so every keystroke asks again. The fake server holds every answer until it is released.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import slow from "./fixtures/async.rx";
import { release, releaseAll, resetServer, server } from "../combobox/fixtures/server.ts";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const answered = () => new Promise((resolve) => setTimeout(resolve, 20));

function setup() {
  const mounted = mount(slow);
  const input = mounted.getByRole("combobox", { name: "Fruit" }) as HTMLInputElement;
  const popup = mounted.getByTestId("popup");
  const options = () =>
    [...popup.querySelectorAll("[role=option]")].map((option) => option.getAttribute("data-value"));
  return { ...mounted, input, popup, options };
}

test("typing while answers are out: the text, the filter and the highlight stay live", async () => {
  const { input, popup, getByTestId, user, options } = setup();
  release("");
  await answered();
  await user.type(input, "pe");
  expect(input.value).toBe("pe");
  expect(getByTestId("text").textContent).toBe("pe");
  expect(popup.matches(":popover-open")).toBe(true);
  expect(popup.hasAttribute("data-loading")).toBe(true);
  expect(getByTestId("status").textContent).toBe("Searching…");
  expect(options()).toEqual(["grape", "peach", "pear"]);
  await user.keyboard("{ArrowDown}");
  expect(input.getAttribute("aria-activedescendant")).not.toBeNull();
  // Out of order: the older answer is dropped.
  release("pe");
  release("p");
  await answered();
  expect(input.value).toBe("pe");
  expect(options()).toEqual(["grape", "peach", "pear"]);
  expect(getByTestId("status").textContent).toBe("");
  await user.keyboard("{Enter}");
  expect(input.value).toBe("Grape");
  expect(new FormData(getByTestId("form") as HTMLFormElement).get("fruit")).toBe("Grape");
});

test("no 'no suggestions' before an answer; it shows once the answer is empty", async () => {
  const { input, getByTestId, user } = setup();
  await user.type(input, "x");
  expect(getByTestId("empty").textContent).toBe("");
  release("");
  release("x");
  await answered();
  expect(getByTestId("empty").textContent).toBe("No suggestions");
});

// Two tests, not one: Solid counts a request that failed as abandoned once the next one starts, and reports a
// run of them (ABANDONED_FLIGHTS). Each half stays under that.
test("a failed request shows in the popup with a retry, which asks again", async () => {
  const { input, popup, getByRole, getByTestId, user } = setup();
  release("");
  await answered();
  server.failing = ["l"];
  await user.type(input, "l");
  release("l");
  await answered();
  expect(getByTestId("error").textContent).toContain('Search failed for "l"');
  expect(popup.matches(":popover-open")).toBe(true);
  const asked = server.calls.length;
  await user.click(getByRole("button", { name: "Retry" }));
  release("l");
  await answered();
  expect(server.calls.length).toBeGreaterThan(asked);
  expect(getByTestId("error")).toBeTruthy();
});

test("after a failed request, typing asks again and the answer replaces the error", async () => {
  const { input, getByTestId, queryByTestId, user, options } = setup();
  release("");
  await answered();
  server.failing = ["l"];
  await user.type(input, "l");
  release("l");
  await answered();
  expect(getByTestId("error")).toBeTruthy();
  await user.type(input, "e");
  release("le");
  await answered();
  expect(queryByTestId("error")).toBeNull();
  expect(options()).toEqual(["apple", "lemon"]);
  expect(input.value).toBe("le");
});

test("a controlled value shows what the app wrote, even when it isn't what was typed", async () => {
  const { getByRole, user } = setup();
  const loud = getByRole("combobox", { name: "Loud" }) as HTMLInputElement;
  await user.type(loud, "ab");
  expect(loud.value).toBe("AB");
});

test("the app's own write to the value, landing while a request is out, replaces the typed text", async () => {
  const { input, getByRole, user } = setup();
  releaseAll();
  await answered();
  await user.type(input, "pe");
  // Written by the app (a button) while the requests for what was typed are still out.
  await user.click(getByRole("button", { name: "Set Lime" }));
  releaseAll();
  await answered();
  releaseAll();
  await answered();
  expect(input.value).toBe("Lime");
});
