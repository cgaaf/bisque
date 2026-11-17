// A combobox beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the combobox is computed from it: the combobox's own state (open, the typed text
// and the filter, the highlighted option, the selected value) must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [
  ["a prop of the popup", "popup-prop"],
  ["a prop of an item", "item-prop"],
  ["an attribute of the input", "input-attribute"],
  ["an attribute of an item", "item-attribute"],
] as const;

for (const [what, id] of cases) {
  test(`it opens, filters, highlights and selects while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const input = getByRole<HTMLInputElement>("combobox", { name: id });
    const popup = getByTestId(`${id}-popup`);
    const option = (value: string) => popup.querySelector<HTMLElement>(`[data-value="${value}"]`);
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");

    // Open.
    await user.click(input);
    await expect.poll(() => input.getAttribute("aria-expanded")).toBe("true");
    expect(popup.matches(":popover-open")).toBe(true);

    // Type: nothing matches, then one option does.
    await user.type(input, "zz");
    expect(input.value).toBe("zz");
    await expect.poll(() => popup.hasAttribute("data-empty")).toBe(true);
    await user.clear(input);
    await user.type(input, "ban");
    await expect.poll(() => option("apple")).toBe(null);
    expect(option("banana")).not.toBe(null);
    expect(popup.hasAttribute("data-empty")).toBe(false);

    // Highlight with the arrow keys.
    await user.keyboard("{ArrowDown}");
    await expect.poll(() => option("banana")!.hasAttribute("data-highlighted")).toBe(true);
    expect(input.getAttribute("aria-activedescendant")).toBe(option("banana")!.id);

    // Select.
    await user.keyboard("{Enter}");
    await expect.poll(() => input.getAttribute("aria-expanded")).toBe("false");
    expect(input.value).toMatch(/^Banana/);
    expect(getByTestId("step").textContent).toBe("1");

    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(input.value).toMatch(/^Banana/);
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });
}
