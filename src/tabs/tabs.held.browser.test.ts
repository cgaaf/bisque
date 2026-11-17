// Tabs beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the tabs is computed from it: the tabs' own state (which tab is selected, its
// panel, the tab stop) must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

// Not fixed yet: `latest` on a prop that reaches this family's provision makes the equations below it run twice per
// action (UNSTABLE_MEMO_OUTPUT, or a real failure in the family's own tests), so those props are still read plainly
// and the part still waits. `test.fails` goes red when someone fixes it: make it a plain test then.
const unfixed = new Set<string>(["Root prop", "Panel prop"]);

const cases = [
  ["a prop of the root", "Root prop", false],
  ["an attribute of the list", "List attribute", true],
  ["a prop of a tab", "Tab prop", true],
  ["a prop of a panel", "Panel prop", true],
  ["an attribute of a tab", "Tab attribute", true],
] as const;

const selected = (tab: HTMLElement) => tab.getAttribute("aria-selected") === "true";

for (const [what, label, keys] of cases) {
  test(`a tab is selected while an app action holds ${what}`, { fails: unfixed.has(label) }, async () => {
    const { getByRole, getByTestId, queryByText, user } = mount(held);
    const a = getByRole("tab", { name: `${label} A` });
    const b = getByRole("tab", { name: `${label} B` });
    const shown = (panel: string) => {
      const element = queryByText(`${label} panel ${panel}`);
      return element != null && !element.hidden;
    };
    expect(selected(a)).toBe(true);
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");

    await user.click(b);
    await answered();
    expect(selected(b)).toBe(true);
    expect(selected(a)).toBe(false);
    expect(b.getAttribute("tabindex")).toBe("0");
    await expect.poll(() => shown("B")).toBe(true);
    await expect.poll(() => shown("A")).toBe(false);

    const byKeys = async () => {
      // Manual activation: the arrow key moves focus, Enter selects.
      b.focus();
      await user.keyboard("{ArrowLeft}");
      expect(document.activeElement).toBe(a);
      await user.keyboard("{Enter}");
      await answered();
      expect(selected(a)).toBe(true);
    };
    const byClick = async () => {
      await user.click(a);
      await answered();
      expect(selected(a)).toBe(true);
    };
    await (keys ? byKeys : byClick)();
    expect(selected(b)).toBe(false);
    await expect.poll(() => shown("A")).toBe(true);

    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(selected(a)).toBe(true);
    expect(shown("A")).toBe(true);
  });
}
