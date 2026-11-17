// An accordion beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a
// plain write, and a prop or attribute of the accordion is computed from it: the accordion's own state (which item
// is open) must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [
  ["a prop of the root", "root-prop", "Root prop"],
  ["a prop of the item", "item-prop", "Item prop"],
  ["an attribute of the item", "item-attribute", "Item attribute"],
] as const;

for (const [what, id, label] of cases) {
  test(`an item opens and closes while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, getByText, user } = mount(held);
    const item = getByTestId<HTMLDetailsElement>(id);
    const trigger = getByText(label).closest("summary")!;
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");
    await user.click(trigger);
    await answered();
    expect(item.open).toBe(true);
    await user.click(trigger);
    await expect.poll(() => item.open).toBe(false);
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(item.open).toBe(false);
  });
}
