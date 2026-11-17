// A field beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the field is computed from it: the field's own
// state (typed, focused, touched, invalid, the error shown) must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

// Not yet live, so expected to fail. The root's `name` (and `disabled`, `invalid`) reach the control's <input> through the
// field's context: read through `latest` there, they make Solid write the input's bound `value` back over what was
// just typed (UNCOMMITTED_INPUT_OVERWRITTEN, even with nothing held), so FieldRoot reads them plainly.
const unwrapped = new Set<string>(["root-prop"]);

const cases = [
  ["a prop of the root", "root-prop", "Root prop"],
  ["an attribute of the root", "root-attribute", "Root attribute"],
  ["an attribute of the control", "control-attribute", "Control attribute"],
  ["an attribute of the label", "label-attribute", "Label attribute"],
  ["an attribute of the description", "description-attribute", "Description attribute"],
  ["a prop of the error", "error-prop", "Error prop"],
] as const;

for (const [what, id, label] of cases) {
  test(
    `a field follows typing, focus and validation while an app action holds ${what}`,
    { fails: unwrapped.has(id) },
    async () => {
      const { getByRole, getByTestId, user } = mount(held);
      const root = getByTestId(id);
      const input = getByRole<HTMLInputElement>("textbox", { name: label });
      await user.click(getByRole("button", { name: "Next" }));
      expect(waiting()).toEqual(["step"]);
      expect(getByTestId("step").textContent).toBe("1");
      await user.click(input);
      await user.type(input, "bad");
      await answered();
      expect(root.hasAttribute("data-focused")).toBe(true);
      expect(root.hasAttribute("data-dirty")).toBe(true);
      expect(root.hasAttribute("data-filled")).toBe(true);
      expect(root.hasAttribute("data-invalid")).toBe(true);
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(root.textContent).toContain(id === "error-prop" ? "Bad" : "");
      await user.tab();
      await answered();
      expect(root.hasAttribute("data-focused")).toBe(false);
      expect(root.hasAttribute("data-touched")).toBe(true);
      expect(getByTestId("step").textContent).toBe("1");
      release("step");
      await answered();
      expect(getByTestId("step").textContent).toBe("2");
      expect(root.hasAttribute("data-touched")).toBe(true);
      expect(root.hasAttribute("data-invalid")).toBe(true);
      expect(input.value).toBe("bad");
    },
  );
}
