// Lists beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and an attribute or prop of a list is computed from it: picking an item up, moving it and dropping it must
// still follow the user while the request is out. An owner's `onValueChange` commonly saves to a server, so this is
// the case a sortable list meets most.
import { afterEach, beforeEach, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { frame, mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

afterEach(async () => {
  await userEvent.pointer({ keys: "[/MouseLeft]" }).catch(() => undefined);
});

const cases = [
  ["an attribute of the root", "root-attribute", "root attribute"],
  ["a prop of the root that reaches its context", "root-prop", "root prop"],
  ["an attribute of the items", "item-attribute", "item attribute"],
  ["an attribute of the handles", "handle-attribute", "handle attribute"],
  ["a prop of a group that reaches its context", "group-list", "group prop"],
] as const;

function rows(list: HTMLElement) {
  return [...list.querySelectorAll("li")].map((li) => li.getAttribute("data-bisque-sortable-item")).join(",");
}

async function hold(mounted: ReturnType<typeof mount>) {
  await mounted.user.click(mounted.getByRole("button", { name: "Next" }));
  expect(waiting()).toEqual(["step"]);
  expect(mounted.getByTestId("step").textContent).toBe("1");
}

for (const [what, id, label] of cases) {
  test(`the keyboard picks up, moves and drops while an app action holds ${what}`, async () => {
    const mounted = mount(held);
    const list = mounted.getByTestId(id);
    await hold(mounted);
    mounted.getByRole("button", { name: `Move a (${label})` }).focus();
    await mounted.user.keyboard(" ");
    await answered();
    expect(list.hasAttribute("data-dragging")).toBe(true);
    // The announcement doesn't wait either. The live region is beside the list (or at the end of its group).
    const live = list.nextElementSibling!.querySelector("[data-bisque-sortable-announcer]")!;
    expect(live.textContent).toBe("Picked up a, position 1 of 3.");
    await mounted.user.keyboard("{ArrowDown}");
    await answered();
    const b = list.querySelector<HTMLElement>('[data-bisque-sortable-item="b"]')!;
    expect(b.hasAttribute("data-shifted")).toBe(true);
    await mounted.user.keyboard(" ");
    await answered();
    expect(rows(list)).toBe("b,a,c");
    expect(list.hasAttribute("data-dragging")).toBe(false);
    release("step");
    await answered();
    expect(mounted.getByTestId("step").textContent).toBe("2");
    expect(rows(list)).toBe("b,a,c");
  });

  test(`a mouse drag moves an item while an app action holds ${what}`, async () => {
    const mounted = mount(held);
    const list = mounted.getByTestId(id);
    await hold(mounted);
    const handle = mounted.getByRole("button", { name: `Move a (${label})` });
    const box = handle.getBoundingClientRect();
    const from = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const moves = Array.from({ length: 8 }, (_, i) => ({
      coords: { x: from.x, y: from.y + ((i + 1) * 80) / 8 },
    }));
    await userEvent.pointer([{ coords: from }, { keys: "[MouseLeft>]" }, ...moves]);
    await frame();
    expect(list.querySelector('[data-bisque-sortable-item="a"]')!.hasAttribute("data-dragging")).toBe(true);
    await userEvent.pointer({ keys: "[/MouseLeft]" });
    await frame();
    await answered();
    expect(rows(list)).toBe("b,c,a");
    release("step");
    await answered();
    expect(rows(list)).toBe("b,c,a");
  });
}
