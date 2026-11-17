// A meter beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the meter is computed from it: the label that mounts while the request is out
// must still name the meter (`aria-labelledby`), which the root learns from the label as it mounts.
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
  test(`a label that mounts names the meter while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, getByText, user } = mount(held);
    const root = getByTestId(id);
    expect(root.hasAttribute("aria-labelledby")).toBe(false);
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");

    await user.click(getByRole("button", { name: "Label" }));
    await answered();
    const labelId = getByText(label).id;
    expect(labelId).not.toBe("");
    expect(root.getAttribute("aria-labelledby")).toBe(labelId);

    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(root.getAttribute("aria-labelledby")).toBe(labelId);
  });
}
