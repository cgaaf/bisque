// A time picker beside an app action that is still waiting for its server (fixtures/held.rx): the picker's own state
// (open, the value chosen) must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [
  ["a prop of the root", "Root prop", "root-prop-popup"],
  ["an attribute of the trigger, popup and a column", "Attribute", "attribute-popup"],
] as const;

for (const [what, label, popupId] of cases) {
  test(`opening and choosing show while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const group = getByRole("group", { name: label });
    const shown = () =>
      Array.from(group.querySelectorAll("[data-bisque-segment]"))
        .map((s) => s.textContent)
        .join("");
    const popup = getByTestId(popupId);
    const option = (column: string, value: string) =>
      popup.querySelector<HTMLElement>(`[role=listbox][aria-label="${column}"] [data-value="${value}"]`)!;
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    await user.click(getByRole("button", { name: `Open ${label.toLowerCase()}` }));
    await expect.poll(() => popup.matches(":popover-open")).toBe(true);
    await expect.poll(() => popup.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(option("Hours", "9"));
    await user.click(option("Minutes", "45"));
    await answered();
    expect(shown()).toBe("9:45 AM");
    expect(option("Minutes", "45").getAttribute("aria-selected")).toBe("true");
    await user.click(option("Hours", "10"));
    await answered();
    expect(shown()).toBe("10:45 AM");
    await user.keyboard("{Escape}");
    await expect.poll(() => popup.matches(":popover-open")).toBe(false);
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(shown()).toBe("10:45 AM");
  });
}
