// A collapsible beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a
// plain write, and a prop or attribute of the collapsible is computed from it: the collapsible's own state (open or
// closed) must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [
  ["an attribute of the trigger", "trigger-attribute", "Trigger attribute"],
  ["an attribute of the panel", "panel-attribute", "Panel attribute"],
  ["a prop of the root", "root-prop", "Root prop"],
] as const;

for (const [what, id, label] of cases) {
  test(`it opens and closes while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, getByText, user } = mount(held);
    const root = getByTestId<HTMLDetailsElement>(id);
    const trigger = getByText(label).closest("summary")!;
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");
    await user.click(trigger);
    await answered();
    expect(root.open).toBe(true);
    await user.click(trigger);
    await expect.poll(() => root.open).toBe(false);
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(root.open).toBe(false);
  });
}
