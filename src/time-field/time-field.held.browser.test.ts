// A time field beside an app action that is still waiting for its server (fixtures/held.rx): the field's own state
// must still follow the user while the request is out.
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
] as const;

for (const [what, label] of cases) {
  test(`stepping and typing show while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const group = getByRole("group", { name: label });
    const shown = () =>
      Array.from(group.querySelectorAll("[data-bisque-segment]"))
        .map((s) => s.textContent)
        .join("");
    const hour = getByRole("spinbutton", { name: `${label} hour` });
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    await user.click(hour);
    await user.keyboard("{ArrowUp}");
    await answered();
    expect(shown()).toBe("10:30 AM");
    expect(hour.getAttribute("aria-valuenow")).toBe("10");
    await user.keyboard("11");
    await answered();
    expect(shown()).toBe("11:30 AM");
    expect(document.activeElement).toBe(getByRole("spinbutton", { name: `${label} minute` }));
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(shown()).toBe("11:30 AM");
  });
}
