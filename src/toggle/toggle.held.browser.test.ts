// A toggle beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and an attribute of the toggle is computed from it: the toggle's own
// state (pressed) must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [["an attribute of the toggle", "Toggle attribute"]] as const;

for (const [what, label] of cases) {
  test(`a toggle presses and releases while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const toggle = getByRole("button", { name: label });
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");
    await user.click(toggle);
    await answered();
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    await user.click(toggle);
    await expect.poll(() => toggle.getAttribute("aria-pressed")).toBe("false");
    await user.click(toggle);
    await expect.poll(() => toggle.getAttribute("aria-pressed")).toBe("true");
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });
}
