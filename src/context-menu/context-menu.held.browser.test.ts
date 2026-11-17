// A context menu beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a
// plain write, and a prop or attribute of the context menu is computed from it: the menu must still open at the
// pointer and close while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

async function next({ getByRole, getByTestId }: ReturnType<typeof mount>) {
  // Not a press: with the menu open, a press on Next would be a press outside it, which closes it.
  getByRole("button", { name: "Next" }).click();
  await answered();
  expect(waiting()).toEqual(["step"]);
  expect(getByTestId("step").textContent).toBe("1");
}

// [what, area, whether the menu is opened before the write (`disabled` goes from false to true)]
const cases = [
  ["an attribute of the trigger", "attribute", false],
  ["a prop of the root (read by Menu's root)", "prop", true],
] as const;

for (const [what, id, openFirst] of cases) {
  test(`the menu opens at the pointer and closes while an app action holds ${what}`, async () => {
    const m = mount(held);
    const { getByTestId, user } = m;
    const area = getByTestId(`${id}-area`);
    const popup = getByTestId(`${id}-popup`);
    if (!openFirst) await next(m);
    await user.click(area, { button: "right", position: { x: 60, y: 40 } });
    await answered();
    expect(area.hasAttribute("data-popup-open")).toBe(true);
    expect(popup.matches(":popover-open")).toBe(true);
    await expect.poll(() => document.activeElement).toBe(popup);
    if (openFirst) await next(m);
    await user.keyboard("{Escape}");
    await answered();
    expect(area.hasAttribute("data-popup-open")).toBe(false);

    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(area.hasAttribute("data-popup-open")).toBe(false);
  });
}
