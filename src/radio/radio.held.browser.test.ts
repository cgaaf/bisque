// A radio group beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a
// plain write, and a prop of the group is computed from it: the checked radio must still
// follow the user (a press, the arrow keys) while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [["a prop of the group", "group-prop", "Group prop"]] as const;

for (const [what, id, label] of cases) {
  test(`a radio is checked by a press and the arrow keys while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const a = getByRole<HTMLInputElement>("radio", { name: `${label} a` });
    const b = getByRole<HTMLInputElement>("radio", { name: `${label} b` });
    const value = getByTestId(id);
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");
    await user.click(a);
    await answered();
    expect(a.checked).toBe(true);
    expect(value.textContent).toBe("a");
    // Safari doesn't focus a pressed radio.
    a.focus();
    await user.keyboard("{ArrowDown}");
    await answered();
    expect(b.checked).toBe(true);
    expect(a.checked).toBe(false);
    expect(value.textContent).toBe("b");
    expect(getByTestId("step").textContent).toBe("1");
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(b.checked).toBe(true);
    expect(value.textContent).toBe("b");
  });
}
