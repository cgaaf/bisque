// A combobox whose options come from a server, used as an app would (fixtures/async.rx): the answer arrives later,
// answers arrive out of order or after the popup closed, a request fails. The fake server (fixtures/server.js)
// holds every answer until the test releases it.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import slow from "./fixtures/async.rx";
import loadOnOpen from "./fixtures/load-on-open.rx";
import { release, releaseAll, resetServer, server } from "./fixtures/server.ts";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

// An answer reaches the screen a little after the request settles.
const answered = () => new Promise((resolve) => setTimeout(resolve, 20));

function setup() {
  const mounted = mount(slow);
  const input = mounted.getByRole("combobox", { name: "Fruit" }) as HTMLInputElement;
  const popup = mounted.getByTestId("popup");
  const options = () =>
    [...popup.querySelectorAll("[role=option]")].map((option) => option.getAttribute("data-value"));
  // The option `aria-activedescendant` names, which must be in the document.
  const active = () => {
    const id = input.getAttribute("aria-activedescendant");
    if (id === null) return null;
    const option = document.getElementById(id);
    expect(option, `aria-activedescendant names a missing element (${id})`).not.toBeNull();
    expect(option!.hasAttribute("data-highlighted")).toBe(true);
    return option!.getAttribute("data-value");
  };
  return { ...mounted, input, popup, options, active };
}

// Both comboboxes have had their first answer.
async function ready() {
  const view = setup();
  release("");
  release("");
  await answered();
  return view;
}

test("before the first answer: loading, and no 'no results'", async () => {
  const { input, popup, getByTestId, user, options } = setup();
  await user.click(input);
  expect(popup.matches(":popover-open")).toBe(true);
  expect(popup.hasAttribute("data-loading")).toBe(true);
  expect(getByTestId("list").getAttribute("aria-busy")).toBe("true");
  expect(getByTestId("status").textContent).toBe("Loading…");
  expect(getByTestId("empty").textContent).toBe("");
  release("");
  await answered();
  expect(options()).toHaveLength(14);
  expect(popup.hasAttribute("data-loading")).toBe(false);
  expect(getByTestId("list").hasAttribute("aria-busy")).toBe(false);
  expect(getByTestId("status").textContent).toBe("");
});

test("typing while an answer is out: the input, the filter and the highlight stay live", async () => {
  const { input, popup, getByTestId, user, options, active } = await ready();
  await user.type(input, "p");
  expect(server.waiting.map((request) => request.query)).toEqual(["p"]);
  // The previous answer stays, narrowed by what was typed, until the new one lands.
  expect(input.value).toBe("p");
  expect(options()).toEqual(["apple", "apricot", "grape", "peach", "pear", "plum"]);
  expect(popup.hasAttribute("data-loading")).toBe(true);
  await user.keyboard("{ArrowDown}");
  expect(active()).toBe("apple");
  await user.type(input, "e");
  expect(input.value).toBe("pe");
  expect(options()).toEqual(["grape", "peach", "pear"]);
  expect(getByTestId("query").textContent).toBe("pe");
});

test("answers that arrive out of order: the older one is dropped", async () => {
  const { input, popup, getByTestId, user, options } = await ready();
  await user.type(input, "pe");
  expect(server.waiting.map((request) => request.query)).toEqual(["p", "pe"]);
  release("pe");
  await answered();
  expect(options()).toEqual(["grape", "peach", "pear"]);
  expect(popup.hasAttribute("data-loading")).toBe(false);
  release("p");
  await answered();
  expect(options()).toEqual(["grape", "peach", "pear"]);
  expect(getByTestId("status").textContent).toBe("");
});

test("while a newer answer is out, Empty stays silent even when the old options all fail the filter", async () => {
  const { input, popup, getByTestId, user, options } = await ready();
  await user.type(input, "px");
  expect(options()).toEqual([]);
  expect(popup.hasAttribute("data-empty")).toBe(true);
  expect(getByTestId("empty").textContent).toBe("");
  release("p");
  release("px");
  await answered();
  expect(getByTestId("empty").textContent).toBe("No fruit found");
});

test("the highlight stays on its value when the options are replaced", async () => {
  const { input, getByTestId, user, active } = await ready();
  // The answer for "a" has Banana second; the old options, filtered, have it third.
  server.hide = ["apricot"];
  await user.type(input, "a");
  await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
  expect(active()).toBe("banana");
  release("a");
  await answered();
  expect(active()).toBe("banana");
  await user.keyboard("{Enter}");
  expect(getByTestId("chosen").textContent).toBe("banana");
  expect(input.value).toBe("Banana");
});

test("a highlight whose option isn't in the new answer goes, and Enter chooses nothing", async () => {
  const { input, popup, getByTestId, user, active } = await ready();
  server.hide = ["banana"];
  await user.type(input, "b");
  await user.keyboard("{ArrowDown}");
  expect(active()).toBe("banana");
  release("b");
  await answered();
  expect(active()).toBe(null);
  await user.keyboard("{Enter}");
  expect(getByTestId("chosen").textContent).toBe("");
  expect(popup.matches(":popover-open")).toBe(true);
});

test("autoHighlight moves to the first option of the new answer", async () => {
  const { getByRole, user } = await ready();
  const input = getByRole("combobox", { name: "Controlled fruit" }) as HTMLInputElement;
  server.hide = ["banana"];
  await user.type(input, "b");
  // Highlighted among the old options at once.
  const first = () =>
    document.getElementById(input.getAttribute("aria-activedescendant") ?? "")?.getAttribute("data-value");
  expect(first()).toBe("banana");
  release("b");
  await answered();
  expect(first()).toBe("blackberry");
});

test("a controlled input whose value a loading question reads stays live", async () => {
  const { getByRole, getByTestId, user } = await ready();
  const input = getByRole("combobox", { name: "Controlled fruit" }) as HTMLInputElement;
  await user.type(input, "pe");
  expect(input.value).toBe("pe");
  expect(getByTestId("controlled-popup").matches(":popover-open")).toBe(true);
  expect(input.getAttribute("aria-activedescendant")).not.toBeNull();
  release("p");
  release("pe");
  await answered();
  expect(input.value).toBe("pe");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(input.value).toBe("Peach");
  expect(getByTestId("controlled-value").textContent).toBe("Peach");
});

test("the selected value keeps its label after its option is gone", async () => {
  const { input, getByRole, getByTestId, user, options } = await ready();
  await user.click(input);
  await user.click(getByRole("option", { name: "Apple" }));
  expect(input.value).toBe("Apple");
  release("Apple");
  await user.clear(input);
  release("");
  // One key per change: a burst of keys against answers that are all held is another test's subject, and each key
  // would abandon the request before it (Solid reports a burst of those, ABANDONED_FLIGHTS).
  await user.type(input, "z");
  releaseAll();
  await answered();
  expect(options()).toEqual([]);
  // Emptying the input cleared the selection; choose again and let a later answer leave it out.
  await user.clear(input);
  release("");
  await answered();
  await user.click(getByRole("option", { name: "Cherry" }));
  release("Cherry");
  await user.type(input, "x");
  releaseAll();
  await answered();
  expect(options()).toEqual([]);
  await user.keyboard("{Escape}");
  expect(input.value).toBe("Cherry");
  expect(getByTestId("value").textContent).toBe("Cherry");
  expect(new FormData(getByTestId("form") as HTMLFormElement).get("fruit")).toBe("cherry");
});

test("a failed request shows in the popup with a retry, and the popup stays usable", async () => {
  const { input, popup, getByRole, getByTestId, queryByTestId, user, options } = await ready();
  server.failing = ["p"];
  await user.type(input, "p");
  release("p");
  await answered();
  expect(getByTestId("error").textContent).toContain('Search failed for "p"');
  expect(popup.matches(":popover-open")).toBe(true);
  expect(popup.hasAttribute("data-loading")).toBe(false);
  expect(queryByTestId("empty")).toBeNull();
  server.failing = [];
  await user.click(getByRole("button", { name: "Retry" }));
  expect(popup.matches(":popover-open")).toBe(true);
  release("p");
  await answered();
  expect(queryByTestId("error")).toBeNull();
  expect(options()).toEqual(["apple", "apricot", "grape", "peach", "pear", "plum"]);
  expect(document.activeElement).toBe(input);
});

test("after a failure, typing asks again and the new answer replaces the error", async () => {
  const { input, getByTestId, queryByTestId, user, options, active } = await ready();
  server.failing = ["p"];
  await user.type(input, "p");
  release("p");
  await answered();
  expect(getByTestId("error")).toBeTruthy();
  await user.type(input, "e");
  release("pe");
  await answered();
  expect(queryByTestId("error")).toBeNull();
  expect(options()).toEqual(["grape", "peach", "pear"]);
  await user.keyboard("{ArrowDown}");
  expect(active()).toBe("grape");
});

test("an answer that lands after the popup closed doesn't reopen it", async () => {
  const { input, popup, user, options } = await ready();
  await user.type(input, "p");
  await user.keyboard("{Escape}");
  expect(popup.matches(":popover-open")).toBe(false);
  releaseAll();
  await answered();
  expect(popup.matches(":popover-open")).toBe(false);
  expect(options()).toHaveLength(14);
});

test("an answer that lands after a choice leaves the choice alone", async () => {
  const { input, popup, getByRole, getByTestId, user } = await ready();
  await user.type(input, "p");
  await user.click(getByRole("option", { name: "Plum" }));
  expect(popup.matches(":popover-open")).toBe(false);
  expect(input.value).toBe("Plum");
  release("p");
  release("Plum");
  await answered();
  expect(popup.matches(":popover-open")).toBe(false);
  expect(input.value).toBe("Plum");
  expect(getByTestId("value").textContent).toBe("Plum");
  expect(getByTestId("chosen").textContent).toBe("plum");
});

test("a combobox that loads when opened opens at once; a choice that starts a lookup closes at once", async () => {
  const { getByRole, getByTestId, user } = mount(loadOnOpen);
  const input = getByRole("combobox", { name: "Fruit" }) as HTMLInputElement;
  const popup = getByTestId("popup");
  expect(server.calls).toEqual([]);
  await user.click(input);
  // Open while the request its `onOpenChange` started is out.
  expect(input.getAttribute("aria-expanded")).toBe("true");
  expect(popup.matches(":popover-open")).toBe(true);
  expect(popup.hasAttribute("data-loading")).toBe(true);
  expect(getByTestId("empty").textContent).toBe("");
  expect(server.calls).toEqual([""]);
  release("");
  await answered();
  await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
  // Chosen and closed while the lookup its `onValueChange` started is out.
  expect(server.waiting.map((request) => request.query)).toContain("apricot");
  expect(popup.matches(":popover-open")).toBe(false);
  expect(input.value).toBe("Apricot");
  expect(getByTestId("looking").textContent).toBe("looking up");
  releaseAll();
  await answered();
  expect(getByTestId("details").textContent).toBe("Apricot");
  expect(input.value).toBe("Apricot");
  // Again, now that the lookup has an answer to hold on to.
  // Typed over the selection without emptying the input, so the choice (and the lookup's answer) stays.
  await user.tripleClick(input);
  await user.keyboard("ch");
  releaseAll();
  await answered();
  await user.click(getByRole("option", { name: "Cherry" }));
  expect(popup.matches(":popover-open")).toBe(false);
  expect(input.value).toBe("Cherry");
  // The details shown are still the previous choice's until the lookup answers.
  expect(getByTestId("looking").textContent).toBe("looking up");
  expect(getByTestId("details").textContent).toBe("Apricot");
  releaseAll();
  await answered();
  expect(getByTestId("details").textContent).toBe("Cherry");
});
