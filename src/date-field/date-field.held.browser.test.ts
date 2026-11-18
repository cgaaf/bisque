// A date field beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a
// plain write, and a prop or attribute of the field is computed from it: the field's own state (stepping, typing,
// moving between segments) must still follow the user while the request is out.
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
  ["an attribute of the input", "Input attribute"],
  ["an attribute of a segment", "Segment attribute"],
] as const;

for (const [what, label] of cases) {
  test(`stepping and typing show while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const group = getByRole("group", { name: label });
    const shown = () =>
      Array.from(group.querySelectorAll("[data-bisque-segment]"))
        .map((s) => s.textContent)
        .join("");
    const day = getByRole("spinbutton", { name: `${label} day` });
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");
    await user.click(day);
    await user.keyboard("{ArrowUp}");
    await answered();
    expect(shown()).toBe("11/18/2026");
    // The segment's own attributes, which a merge with a held attribute would freeze.
    expect(day.getAttribute("aria-valuenow")).toBe("18");
    expect(group.hasAttribute("data-focused")).toBe(true);
    await user.keyboard("2");
    await answered();
    expect(shown()).toBe("11/2/2026");
    await user.keyboard("5");
    await answered();
    expect(shown()).toBe("11/25/2026");
    expect(day.getAttribute("aria-valuenow")).toBe("25");
    expect(document.activeElement).toBe(getByRole("spinbutton", { name: `${label} year` }));
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(shown()).toBe("11/25/2026");
  });
}
