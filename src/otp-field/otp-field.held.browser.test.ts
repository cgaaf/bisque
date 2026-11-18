// An OTP field beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a
// plain write, and a prop or attribute of the field is computed from it: the code being typed, and focus moving on
// from slot to slot, must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [
  ["a prop of the root", "root-prop"],
  ["an attribute of the root", "root-attribute"],
  ["an attribute of a slot", "slot-attribute"],
] as const;

for (const [what, id] of cases) {
  test(`typing fills the slots and Backspace empties them while an app action holds ${what}`, async () => {
    const mounted = mount(held);
    await frame();
    const slots = [
      ...document
        .getElementById(id)!
        .closest('[role="group"]')!
        .querySelectorAll<HTMLInputElement>("[data-bisque-otp-slot]"),
    ];
    const root = slots[0].closest<HTMLElement>('[role="group"]')!;
    const values = () => slots.map((slot) => slot.value).join("");
    await mounted.user.click(mounted.getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(mounted.getByTestId("step").textContent).toBe("1");
    await mounted.user.click(slots[0]);
    await mounted.user.keyboard("1234");
    await answered();
    expect(values()).toBe("1234");
    expect(document.activeElement).toBe(slots[3]);
    // The root's own state attributes follow too.
    expect(root.hasAttribute("data-complete")).toBe(true);
    expect(slots.every((slot) => slot.hasAttribute("data-filled"))).toBe(true);
    expect(slots.map((slot) => slot.tabIndex)).toEqual([-1, -1, -1, 0]);
    await mounted.user.keyboard("{Backspace}{Backspace}");
    await answered();
    expect(values()).toBe("12");
    expect(document.activeElement).toBe(slots[1]);
    expect(root.hasAttribute("data-complete")).toBe(false);
    expect(root.hasAttribute("data-filled")).toBe(true);
    expect(mounted.getByTestId("step").textContent).toBe("1");
    release("step");
    await answered();
    expect(mounted.getByTestId("step").textContent).toBe("2");
    expect(values()).toBe("12");
  });
}
