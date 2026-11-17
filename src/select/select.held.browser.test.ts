// A select beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the select is computed from it: the select's own state (open, the highlighted
// item, the selected value) must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [
  ["a prop of an item", "item-prop"],
  ["an attribute of the trigger", "trigger-attribute"],
  ["an attribute of an item", "item-attribute"],
] as const;

for (const [what, id] of cases) {
  test(`it opens, highlights and selects while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const trigger = getByTestId(id);
    const value = getByTestId(`${id}-value`);
    const popup = document.getElementById(trigger.getAttribute("aria-controls")!)!;
    const option = (name: string) => popup.querySelector(`[data-value="${name}"]`)!;
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");

    // Open and close.
    await user.click(trigger);
    await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.hasAttribute("data-popup-open")).toBe(true);
    await user.keyboard("{Escape}");
    await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("false");

    // Highlight with the arrow keys.
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await expect.poll(() => option("apple").hasAttribute("data-highlighted")).toBe(true);
    await user.keyboard("{ArrowDown}");
    await expect.poll(() => option("banana").hasAttribute("data-highlighted")).toBe(true);
    expect(option("apple").hasAttribute("data-highlighted")).toBe(false);

    // Select.
    await user.keyboard("{Enter}");
    await expect.poll(() => value.textContent).toBe("Banana");
    expect(option("banana").getAttribute("aria-selected")).toBe("true");
    await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("false");
    expect(getByTestId("step").textContent).toBe("1");

    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(value.textContent).toBe("Banana");
    expect(option("banana").getAttribute("aria-selected")).toBe("true");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
}
