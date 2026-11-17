// An autocomplete beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a
// plain write, and a prop or attribute of the autocomplete is computed from it: the autocomplete's own state (open,
// the typed text and the filter, the highlighted suggestion) must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [
  ["a prop of a suggestion", "item-prop"],
  ["an attribute of the input", "input-attribute"],
] as const;

for (const [what, id] of cases) {
  test(`it opens, filters, highlights and completes while an app action holds ${what}`, async () => {
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

    // Type: the suggestions are filtered.
    await user.type(input, "fi");
    expect(input.value).toBe("fi");
    await expect.poll(() => option("docs")).toBe(null);
    expect(option("feature")).toBe(null);
    expect(option("fix")).not.toBe(null);

    // Highlight with the arrow keys.
    await user.keyboard("{ArrowDown}");
    await expect.poll(() => option("fix")!.hasAttribute("data-highlighted")).toBe(true);
    expect(input.getAttribute("aria-activedescendant")).toBe(option("fix")!.id);

    // Complete.
    await user.keyboard("{Enter}");
    await expect.poll(() => input.getAttribute("aria-expanded")).toBe("false");
    expect(input.value).toMatch(/^fix/);
    expect(getByTestId("step").textContent).toBe("1");

    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(input.value).toMatch(/^fix/);
  });
}
