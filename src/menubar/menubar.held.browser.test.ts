// A menubar beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the bar is computed from it: which menu is open must still follow the user while
// the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [
  ["a prop of the root", "Prop"],
  ["an attribute of the root", "Attribute"],
] as const;

// Known to fail: `dir`, `loop` and `isDisabled` in MenubarRoot (menubar.rx:28-30) are left without `latest`. Read
// through `latest`, any of them reaches the `menubar` provision, and the existing menubar tests that move between
// menus then report UNSTABLE_MEMO_OUTPUT.
const unfixed = (what: string) => what == "a prop of the root";

for (const [what, prefix] of cases) {
  test(
    `a menu opens, hands over to its neighbour and closes while an app action holds ${what}`,
    { fails: unfixed(what) },
    async () => {
      const { getByRole, getByTestId, user } = mount(held);
      const file = getByRole("menuitem", { name: `${prefix} File` });
      const edit = getByRole("menuitem", { name: `${prefix} Edit` });
      const bar = file.closest('[role="menubar"]')!;
      await user.click(getByRole("button", { name: "Next" }));
      expect(waiting()).toEqual(["step"]);
      expect(getByTestId("step").textContent).toBe("1");

      await user.click(file);
      await answered();
      expect(file.getAttribute("aria-expanded")).toBe("true");
      expect(bar.hasAttribute("data-has-submenu-open")).toBe(true);
      // ArrowRight in the open menu moves to the neighbour.
      await expect.poll(() => document.activeElement?.id).toBe(file.getAttribute("aria-controls"));
      await user.keyboard("{ArrowRight}");
      await answered();
      expect(edit.getAttribute("aria-expanded")).toBe("true");
      expect(file.getAttribute("aria-expanded")).toBe("false");
      await user.keyboard("{Escape}");
      await answered();
      expect(edit.getAttribute("aria-expanded")).toBe("false");
      expect(bar.hasAttribute("data-has-submenu-open")).toBe(false);

      release("step");
      await answered();
      expect(getByTestId("step").textContent).toBe("2");
      expect(edit.getAttribute("aria-expanded")).toBe("false");
      expect(file.getAttribute("aria-expanded")).toBe("false");
    },
  );
}
