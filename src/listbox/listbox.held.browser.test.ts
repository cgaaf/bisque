// A listbox beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the listbox is computed from it: the selection must still follow the user (a
// press, the keyboard, several actions in a row) while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [
  ["a prop of the root", "Root prop"],
  ["an attribute of the root", "Root attribute"],
  ["a prop of an item", "Item prop"],
  ["an attribute of an item", "Item attribute"],
] as const;

for (const [what, label] of cases) {
  test(`options are selected by presses and keys while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const list = getByRole("listbox", { name: label });
    const option = (value: string) => list.querySelector(`[data-value="${value}"]`) as HTMLElement;
    const selected = () =>
      [...list.querySelectorAll("[aria-selected=true]")].map((element) => element.getAttribute("data-value"));
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);

    await user.click(option("a"));
    await answered();
    expect(selected()).toEqual(["a"]);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    await answered();
    expect(selected()).toEqual(["a", "b"]);
    await user.keyboard("{ArrowDown}{ }");
    await answered();
    expect(selected()).toEqual(["a", "b", "c"]);
    await user.keyboard("{ }");
    await answered();
    expect(selected()).toEqual(["a", "b"]);
    await user.click(option("a"));
    await answered();
    expect(selected()).toEqual(["b"]);
    expect(document.activeElement).toBe(option("a"));
    expect(getByTestId("step").textContent).toBe("1");

    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(selected()).toEqual(["b"]);
  });
}

test("a part inside the listbox reads the selection while an app action is held", async () => {
  const { getByRole, getByTestId, user } = mount(held);
  const list = getByRole("listbox", { name: "Root prop" });
  await user.click(getByRole("button", { name: "Next" }));
  await user.click(list.querySelector('[data-value="b"]') as HTMLElement);
  await answered();
  expect(getByTestId("root-prop").textContent).toBe("b");
  expect(getByTestId("step").textContent).toBe("1");
  release("step");
  await answered();
});

const pressCases = [
  ["a prop of the root that reaches its context (orientation)", "Root orientation"],
  ["the disabled state of an option", "Item disabled"],
] as const;

for (const [what, label] of pressCases) {
  test(`options are selected by presses and Space while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const list = getByRole("listbox", { name: label });
    const option = (value: string) => list.querySelector(`[data-value="${value}"]`) as HTMLElement;
    const selected = () =>
      [...list.querySelectorAll("[aria-selected=true]")].map((element) => element.getAttribute("data-value"));
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);

    await user.click(option("c"));
    await answered();
    expect(selected()).toEqual(["c"]);
    await user.click(option("a"));
    await answered();
    expect(selected()).toEqual(["a", "c"]);
    await user.keyboard("{ }");
    await answered();
    expect(selected()).toEqual(["c"]);
    await user.click(option("b"));
    await answered();
    expect(selected()).toEqual(["b", "c"]);
    await user.click(option("c"));
    await answered();
    expect(selected()).toEqual(["b"]);
    expect(getByTestId("step").textContent).toBe("1");

    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(selected()).toEqual(["b"]);
  });
}
