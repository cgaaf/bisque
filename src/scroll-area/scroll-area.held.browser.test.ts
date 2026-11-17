// A scroll area beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a
// plain write, and a prop or attribute of the scroll area is computed from it: the scroll area's own state (scroll
// position, overflow edges, the thumb, hover) must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

// Not fixed yet: `latest` on a prop that reaches this family's provision makes the equations below it run twice per
// action (UNSTABLE_MEMO_OUTPUT, or a real failure in the family's own tests), so those props are still read plainly
// and the part still waits. `test.fails` goes red when someone fixes it: make it a plain test then.
const unfixed = new Set<string>(["root-prop"]);

const cases = [
  ["a prop of the root", "root-prop"],
  ["a prop of the scrollbar", "scrollbar-prop"],
  ["an attribute of the root", "root-attribute"],
  ["an attribute of the viewport", "viewport-attribute"],
  ["an attribute of the scrollbar", "scrollbar-attribute"],
] as const;

for (const [what, id] of cases) {
  test(
    `scrolling and hovering show while an app action holds ${what}`,
    { fails: unfixed.has(id) },
    async () => {
      const { getByRole, getByTestId, user } = mount(held);
      const root = getByTestId(id);
      const viewport = root.firstElementChild as HTMLElement;
      const scrollbar = () => root.querySelector<HTMLElement>('[aria-hidden="true"]')!;
      await frame();
      await frame();
      expect(root.hasAttribute("data-overflow-y-end")).toBe(true);
      expect(root.hasAttribute("data-overflow-y-start")).toBe(false);

      await user.click(getByRole("button", { name: "Next" }));
      expect(waiting()).toEqual(["step"]);
      expect(getByTestId("step").textContent).toBe("1");

      viewport.scrollTop = 40;
      await expect.poll(() => root.hasAttribute("data-overflow-y-start")).toBe(true);
      await expect.poll(() => viewport.style.getPropertyValue("--scroll-area-overflow-y-start")).toBe("40px");
      await user.hover(viewport);
      await answered();
      expect(scrollbar().hasAttribute("data-hovering")).toBe(true);

      release("step");
      await answered();
      expect(getByTestId("step").textContent).toBe("2");
      expect(root.hasAttribute("data-overflow-y-start")).toBe(true);
      expect(scrollbar().hasAttribute("data-hovering")).toBe(true);
    },
  );
}
