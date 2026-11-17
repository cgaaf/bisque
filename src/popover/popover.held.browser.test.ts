// A popover beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the popover is computed from it: the popover's own state (open or closed) must
// still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const shown = (popup: HTMLElement) => popup.matches(":popover-open");

const cases = [
  ["an attribute of the trigger", "trigger-attribute", "Trigger attribute"],
  ["an attribute of the popup", "popup-attribute", "Popup attribute"],
] as const;

for (const [what, id, label] of cases) {
  test(`it opens and closes while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const popup = getByTestId(id);
    const trigger = getByRole("button", { name: label });
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");
    await user.click(trigger);
    await answered();
    expect(shown(popup)).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await user.click(trigger);
    await answered();
    expect(shown(popup)).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(shown(popup)).toBe(false);
  });
}
