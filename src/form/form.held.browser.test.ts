// A form beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and an attribute of the form is computed from it: the form's own state (a submit in flight) and its
// fields' must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [["an attribute of the form", "form-attribute", "Form attribute", "attribute"]] as const;

for (const [what, id, label, key] of cases) {
  test(`a form's field and submit follow the user while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const form = getByTestId(id);
    const field = getByTestId(`${id}-field`);
    const input = getByRole<HTMLInputElement>("textbox", { name: label });
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");
    await user.click(input);
    await user.type(input, "x");
    await answered();
    expect(field.hasAttribute("data-dirty")).toBe(true);
    await user.click(getByRole("button", { name: `Submit ${label.toLowerCase()}` }));
    await answered();
    expect(waiting()).toEqual(["step", key]);
    expect(form.hasAttribute("data-submitting")).toBe(true);
    release(key);
    await answered();
    expect(form.hasAttribute("data-submitting")).toBe(false);
    expect(getByTestId("step").textContent).toBe("1");
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(field.hasAttribute("data-dirty")).toBe(true);
    expect(input.value).toBe("x");
  });
}
