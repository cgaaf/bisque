// A switch beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the switch is computed from it: the switch's own state (on or off) must still
// follow the user while the request is out.
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
  ["an attribute of the root", "root-attribute", "Root attribute"],
] as const;

for (const [what, id, label] of cases) {
  test(`a switch turns on and off while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const control = getByRole<HTMLInputElement>("switch", { name: label });
    const state = getByTestId(id);
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");
    await user.click(control);
    await answered();
    expect(control.checked).toBe(true);
    expect(state.textContent).toBe("on");
    await user.click(control);
    await answered();
    expect(control.checked).toBe(false);
    expect(state.textContent).toBe("off");
    await user.click(control);
    await answered();
    expect(control.checked).toBe(true);
    expect(getByTestId("step").textContent).toBe("1");
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(control.checked).toBe(true);
    expect(state.textContent).toBe("on");
  });
}
