// A navigation menu beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a
// plain write, and a prop or attribute of the menu is computed from it: which item is open must still follow the
// user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

// A prop or attribute of the content holds nothing the open item waits for (both cases passed before the fix), so
// they aren't here.
const cases = [
  ["a prop of the root", "Root prop"],
  ["a prop of the item", "Item prop"],
  ["an attribute of the trigger", "Trigger attribute"],
] as const;

async function next({ getByRole, getByTestId }: ReturnType<typeof mount>) {
  // Not a press: with an item open, a press on Next would be a press outside its content, which closes it.
  getByRole("button", { name: "Next" }).click();
  await answered();
  expect(waiting()).toEqual(["step"]);
  expect(getByTestId("step").textContent).toBe("1");
}

// Known to fail: `dir` and the `delay` and `closeDelay` fields of the root's provision (navigation-menu.rx:59, 91-92)
// are left without `latest`. Read through `latest`, any of them reaches the `navigationMenu` provision, and the
// existing tests that switch items then report UNSTABLE_MEMO_OUTPUT.
const unfixed = (what: string) => what == "a prop of the root";

for (const [what, label] of cases) {
  test(`an item opens and closes while an app action holds ${what}`, { fails: unfixed(what) }, async () => {
    const m = mount(held);
    const { getByRole, getByTestId, user } = m;
    const trigger = getByRole("button", { name: label });
    await next(m);

    await user.click(trigger);
    await answered();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.hasAttribute("data-popup-open")).toBe(true);
    await user.click(trigger);
    await answered();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
}

// `disabled` goes from false to true, so the item is opened first; closing it doesn't depend on the trigger.
test("an open item closes while an app action holds a prop of the trigger", async () => {
  const m = mount(held);
  const { getByRole, getByTestId, user } = m;
  const trigger = getByRole("button", { name: "Trigger prop" });
  await user.click(trigger);
  await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("true");
  await next(m);

  await user.keyboard("{Escape}");
  await answered();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(trigger.hasAttribute("data-popup-open")).toBe(false);

  release("step");
  await answered();
  expect(getByTestId("step").textContent).toBe("2");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});
