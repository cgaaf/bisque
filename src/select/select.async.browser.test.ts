// Selects whose options come from a server, used as an app would (fixtures/async.rx): options that load once and
// late, options loaded when the select is first opened, a load that fails. The fake server holds every answer until
// the test releases it.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import slow from "./fixtures/async.rx";
import dependent from "./fixtures/dependent.rx";
import { release, releaseAll, resetServer, server } from "../combobox/fixtures/server.ts";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

// An answer reaches the screen a little after the request settles.
const answered = () => new Promise((resolve) => setTimeout(resolve, 20));
const focused = () => (document.activeElement as HTMLElement | null)?.getAttribute("data-value");

test("a value chosen before its options load is named once they arrive, not shown raw", async () => {
  const { getByTestId } = mount(slow);
  const trigger = getByTestId("trigger");
  expect(getByTestId("value").textContent).toBe("");
  expect(trigger.hasAttribute("data-loading")).toBe(true);
  expect(trigger.hasAttribute("data-placeholder")).toBe(false);
  expect(new FormData(getByTestId("form") as HTMLFormElement).get("fruit")).toBe("cherry");
  release("");
  await answered();
  expect(getByTestId("value").textContent).toBe("Cherry");
  expect(trigger.hasAttribute("data-loading")).toBe(false);
});

test("opened before its options arrive: busy, then focus moves to the selected item", async () => {
  const { getByTestId, user } = mount(slow);
  const popup = getByTestId("popup");
  getByTestId("trigger").focus();
  await user.keyboard("{ArrowDown}");
  expect(popup.matches(":popover-open")).toBe(true);
  expect(popup.getAttribute("aria-busy")).toBe("true");
  expect(document.activeElement).toBe(popup);
  release("");
  await answered();
  expect(popup.hasAttribute("aria-busy")).toBe(false);
  await expect.poll(focused).toBe("cherry");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(getByTestId("chosen").textContent).toBe("fig");
  expect(getByTestId("value").textContent).toBe("Fig");
});

test("a select that loads when first opened opens at once, and its options take focus when they arrive", async () => {
  const { getByTestId, user } = mount(slow);
  const popup = getByTestId("later-popup");
  expect(server.calls).toEqual([""]);
  getByTestId("later-trigger").focus();
  await user.keyboard("{ArrowDown}");
  // Open while the request its `onOpenChange` started is out: the select's own state, not only the browser's.
  expect(popup.matches(":popover-open")).toBe(true);
  expect(getByTestId("later-trigger").getAttribute("aria-expanded")).toBe("true");
  expect(popup.getAttribute("aria-busy")).toBe("true");
  expect(server.calls).toEqual(["", ""]);
  release("");
  release("");
  await answered();
  await expect.poll(focused).toBe("apple");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(popup.matches(":popover-open")).toBe(false);
  expect(getByTestId("later-value").textContent).toBe("Apricot");
});

test("a failed load shows in the popup with a retry", async () => {
  server.failing = [""];
  const { getByRole, getByTestId, queryByTestId, user } = mount(slow);
  release("");
  await answered();
  const trigger = getByTestId("trigger");
  expect(trigger.hasAttribute("data-loading")).toBe(false);
  await user.click(trigger);
  const popup = getByTestId("popup");
  expect(popup.matches(":popover-open")).toBe(true);
  expect(getByTestId("error").textContent).toContain("Search failed");
  server.failing = [];
  await user.click(getByRole("button", { name: "Retry" }));
  expect(popup.matches(":popover-open")).toBe(true);
  release("");
  await answered();
  expect(queryByTestId("error")).toBeNull();
  expect(popup.querySelectorAll("[role=option]")).toHaveLength(14);
  expect(getByTestId("value").textContent).toBe("Cherry");
});

test("a controlled value a loading question reads: `value={latest x}` shows the choice at once", async () => {
  const { getByTestId, user } = mount(dependent);
  releaseAll();
  await answered();
  const choose = async (which: string, index: number) => {
    await user.click(getByTestId(which));
    await user.click(getByTestId(`${which}-popup`).querySelectorAll<HTMLElement>("[role=option]")[index]);
  };
  // `value={fruit}`: the select closes at once, and shows the choice with everything else that reads `fruit`.
  await choose("plain", 1);
  expect(getByTestId("plain-popup").matches(":popover-open")).toBe(false);
  expect(getByTestId("trigger-plain-value").textContent).toBe("Apple");
  releaseAll();
  await answered();
  expect(getByTestId("trigger-plain-value").textContent).toBe("Cherry");
  // `value={latest fruit}`: the value it is moving to, at once.
  await choose("latest", 0);
  expect(getByTestId("trigger-latest-value").textContent).toBe("Apple");
  expect(getByTestId("latest-popup").querySelector("[aria-selected=true]")?.textContent).toBe("Apple");
  releaseAll();
  await answered();
  expect(getByTestId("trigger-latest-value").textContent).toBe("Apple");
  expect(getByTestId("trigger-plain-value").textContent).toBe("Apple");
});

test("opened with the pointer before its options arrive, the select's own state is open at once", async () => {
  const { getByTestId, user } = mount(slow);
  const trigger = getByTestId("later-trigger");
  await user.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.hasAttribute("data-popup-open")).toBe(true);
  expect(getByTestId("later-popup").getAttribute("aria-busy")).toBe("true");
  releaseAll();
  await answered();
  expect(getByTestId("later-popup").querySelectorAll("[role=option]")).toHaveLength(14);
});
