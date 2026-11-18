// A time range picker beside an app action that is still waiting for its server (fixtures/held.rx): the picker's own
// state must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const shown = (group: HTMLElement) =>
  Array.from(group.querySelectorAll("[data-bisque-segment]"))
    .map((s) => s.textContent)
    .join("");

const cases = [
  ["a prop of the root", "Root prop", "root-prop-popup"],
  ["an attribute of the group", "Attribute", "attribute-popup"],
] as const;

for (const [what, label, popupId] of cases) {
  test(`opening, choosing and typing show while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const start = getByRole("group", { name: `${label} start` });
    const end = getByRole("group", { name: `${label} end` });
    const popup = getByTestId(popupId);
    const option = (column: string, value: string) =>
      popup.querySelector<HTMLElement>(`[role=listbox][aria-label="${column}"] [data-value="${value}"]`)!;
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    await user.click(getByRole("button", { name: `Open ${label.toLowerCase()}` }));
    await expect.poll(() => popup.contains(document.activeElement)).toBe(true);
    await user.click(option("Minutes", "30"));
    await answered();
    expect(shown(start)).toBe("9:30 AM");
    await user.click(option("Hours", "10"));
    await answered();
    expect(shown(start)).toBe("10:30 AM");
    await user.keyboard("{Escape}");
    await user.click(end.querySelector<HTMLElement>("[role=spinbutton][data-type=hour]")!);
    await user.keyboard("{ArrowUp}");
    await answered();
    expect(shown(end)).toBe("6:00 PM");
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(shown(start)).toBe("10:30 AM");
    expect(shown(end)).toBe("6:00 PM");
  });
}
