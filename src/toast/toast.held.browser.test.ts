// Toasts beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the provider, viewport or toast is computed from it: the toasts' own state
// (expanded while hovered, closing when dismissed) must still follow the user while the request is out.
import { within } from "@testing-library/dom";
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
const unfixed = new Set<string>(["provider-prop"]);

const cases = [
  ["a prop of the provider", "provider-prop"],
  ["a prop of the toast", "root-prop"],
  ["an attribute of the toast", "root-attribute"],
  ["an attribute of the viewport", "viewport-attribute"],
] as const;

for (const [what, id] of cases) {
  test(
    `a toast expands on hover and closes while an app action holds ${what}`,
    { fails: unfixed.has(id) },
    async () => {
      const { getByRole, getByTestId, user } = mount(held);
      const viewport = getByTestId(id);
      const toasts = () => [...viewport.querySelectorAll<HTMLElement>("[data-bisque-toast]")];
      const open = () => toasts().filter((el) => !el.hasAttribute("data-ending-style"));
      await user.click(getByRole("button", { name: `Add ${id}` }));
      await expect.poll(() => toasts().length).toBe(1);

      await user.click(getByRole("button", { name: "Next" }));
      expect(waiting()).toEqual(["step"]);
      expect(getByTestId("step").textContent).toBe("1");

      await user.hover(toasts()[0]);
      await answered();
      expect(viewport.hasAttribute("data-expanded")).toBe(true);
      expect(toasts()[0].hasAttribute("data-expanded")).toBe(true);

      await user.click(within(viewport).getByText("Dismiss"));
      await answered();
      expect(open()).toEqual([]);
      await expect.poll(() => toasts().length).toBe(0);

      release("step");
      await answered();
      expect(getByTestId("step").textContent).toBe("2");
      expect(toasts()).toEqual([]);
    },
  );
}
