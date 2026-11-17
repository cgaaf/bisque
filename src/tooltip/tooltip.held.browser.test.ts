// A tooltip beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the tooltip is computed from it: the tooltip's own state (shown or hidden) must
// still follow the pointer while the request is out.
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
  ["a prop of the root", "root-prop", "Root prop"],
  ["a prop of the popup", "popup-prop", "Popup prop"],
  ["an attribute of the trigger", "trigger-attribute", "Trigger attribute"],
] as const;

for (const [what, id, label] of cases) {
  test(`it opens and closes while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const popup = getByTestId(id);
    const trigger = getByRole("button", { name: label });
    // The real pointer stays where the last test left it: start away from every trigger.
    await user.hover(getByTestId("outside"));
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");
    await user.hover(trigger);
    await expect.poll(() => shown(popup)).toBe(true);
    expect(trigger.getAttribute("aria-describedby")).toBe(popup.id);
    await user.hover(getByTestId("outside"));
    await expect.poll(() => shown(popup)).toBe(false);
    expect(trigger.hasAttribute("aria-describedby")).toBe(false);
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(shown(popup)).toBe(false);
  });
}
