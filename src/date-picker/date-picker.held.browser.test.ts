// Date pickers beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a
// plain write, and a prop or attribute of a picker part is computed from it: opening, picking, closing and typing
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
  ["an attribute of the group", "Group attribute"],
  ["attributes of the trigger and popup, and a calendar prop", "Popup attribute"],
] as const;

for (const [what, label] of cases) {
  test(`opening, picking twice and typing show while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const group = getByRole("group", { name: label });
    const trigger = getByRole("button", { name: `Calendar ${label}` });
    const popup = document.getElementById(trigger.getAttribute("popovertarget")!)!;
    const day = (iso: string) =>
      popup.querySelector<HTMLButtonElement>(`button[data-date="${iso}"]:not([data-outside-month])`)!;
    const shown = () =>
      Array.from(group.querySelectorAll("[data-bisque-segment]"))
        .map((s) => s.textContent)
        .join("");
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    for (const [from, to] of [
      ["2030-05-08", "5/9/2030"],
      ["2030-05-09", "5/10/2030"],
    ]) {
      trigger.focus();
      // oxlint-disable-next-line no-await-in-loop -- each step acts on what the one before left
      await user.keyboard("{Enter}");
      // oxlint-disable-next-line no-await-in-loop
      await expect.poll(() => popup.matches(":popover-open")).toBe(true);
      // oxlint-disable-next-line no-await-in-loop
      await expect.poll(() => document.activeElement).toBe(day(from));
      // oxlint-disable-next-line no-await-in-loop
      await user.keyboard("{ArrowRight}{Enter}");
      // oxlint-disable-next-line no-await-in-loop
      await expect.poll(() => popup.matches(":popover-open")).toBe(false);
      expect(shown()).toBe(to);
      expect(document.activeElement).toBe(trigger);
    }
    await user.click(getByRole("spinbutton", { name: `${label} day` }));
    await user.keyboard("{ArrowUp}");
    expect(shown()).toBe("5/11/2030");
    // The picker's own state attribute on the group, which a merge with a held attribute would freeze.
    await user.keyboard("{Backspace}{Backspace}");
    expect(group.hasAttribute("data-invalid")).toBe(true);
    await user.keyboard("11");
    expect(group.hasAttribute("data-invalid")).toBe(false);
    expect(shown()).toBe("5/11/2030");
    // Back to the date it had before the app's action: the picker takes it (the calendar shows it chosen).
    getByRole("spinbutton", { name: `${label} day` }).focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(shown()).toBe("5/8/2030");
    trigger.focus();
    await user.keyboard("{Enter}");
    await expect.poll(() => document.activeElement).toBe(day("2030-05-08"));
    expect(day("2030-05-08").hasAttribute("data-selected")).toBe(true);
    await user.keyboard("{Escape}");
    await expect.poll(() => popup.matches(":popover-open")).toBe(false);
    expect(getByTestId("step").textContent).toBe("1");
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(shown()).toBe("5/8/2030");
  });
}
