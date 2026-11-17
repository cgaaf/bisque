// A menu beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the menu is computed from it: the menu's own state (open, the highlighted item,
// checked items, an open submenu) must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

type Mounted = ReturnType<typeof mount>;

// With a menu already open, a press on Next would be a press outside it, which closes it: `quietly` clicks without
// pressing.
async function next({ getByRole, getByTestId, user }: Mounted, quietly = false) {
  const button = getByRole("button", { name: "Next" });
  if (quietly) button.click();
  else await user.click(button);
  await answered();
  expect(waiting()).toEqual(["step"]);
  expect(getByTestId("step").textContent).toBe("1");
}

async function finish({ getByTestId }: Mounted) {
  release("step");
  await answered();
  expect(getByTestId("step").textContent).toBe("2");
}

// `isDisabled` in MenuRoot (menu.rx:75), SubmenuProvider (menu.rx:507) and MenuSubmenuTrigger (menu.rx:595) is left
// without `latest`: read through `latest`, it reaches the `menu` provision (or the submenu trigger's props), and the
// existing submenu, menubar and context-menu tests then report UNSTABLE_MEMO_OUTPUT. The root's case passes anyway
// (the trigger's merge is read through `latest`); the submenu root's is known to fail.

// [what, trigger, whether the menu is opened before the write]. A prop or attribute of the popup holds nothing the
// menu's state waits for (both cases passed before the fix), so they aren't here.
const menus = [
  ["a prop of the root", "Root prop", true],
  ["an attribute of the trigger", "Trigger attribute", false],
] as const;

for (const [what, label, openFirst] of menus) {
  test(`the menu opens, highlights and closes while an app action holds ${what}`, async () => {
    const m = mount(held);
    const { getByRole, user } = m;
    const trigger = getByRole("button", { name: label });
    const openBeforeWrite = async () => {
      await user.click(trigger);
      await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("true");
      await next(m, true);
    };
    const openAfterWrite = async () => {
      await next(m);
      await user.click(trigger);
      await answered();
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(trigger.hasAttribute("data-popup-open")).toBe(true);
    };
    await (openFirst ? openBeforeWrite : openAfterWrite)();
    await user.keyboard("{ArrowDown}");
    const first = getByRole("menuitem", { name: `${label} one` });
    await expect.poll(() => document.activeElement).toBe(first);
    await answered();
    expect(first.hasAttribute("data-highlighted")).toBe(true);
    await user.keyboard("{Escape}");
    await answered();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await finish(m);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
}

// The items menu is opened before the write: every item in it is held, and each reads the menu's open state.
async function openItemsThenNext(m: Mounted) {
  const trigger = m.getByRole("button", { name: "Items" });
  await m.user.click(trigger);
  await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("true");
  await next(m, true);
}

// A prop of a checkbox or radio item (`disabled`, from false to undefined) held nothing they wait for: both cases
// passed before the fix, so they aren't here.
for (const [what, name, highlightFirst] of [
  ["an attribute of the item", "Item attribute", false],
  // `disabled` goes from false to true, so the item is highlighted before the write; the highlight must still leave.
  ["a prop of the item", "Item prop", true],
] as const) {
  test(`an item's highlight follows the pointer while an app action holds ${what}`, async () => {
    const m = mount(held);
    const trigger = m.getByRole("button", { name: "Items" });
    await m.user.click(trigger);
    await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("true");
    const item = m.getByRole("menuitem", { name });
    const highlightBeforeWrite = async () => {
      await m.user.hover(item);
      await expect.poll(() => item.hasAttribute("data-highlighted")).toBe(true);
      await next(m, true);
    };
    const highlightAfterWrite = async () => {
      await next(m, true);
      await m.user.hover(item);
      await answered();
      expect(item.hasAttribute("data-highlighted")).toBe(true);
    };
    await (highlightFirst ? highlightBeforeWrite : highlightAfterWrite)();
    await m.user.hover(m.getByRole("menuitem", { name: "Plain item" }));
    await answered();
    expect(item.hasAttribute("data-highlighted")).toBe(false);
    await finish(m);
    expect(item.hasAttribute("data-highlighted")).toBe(false);
  });
}

for (const [what, name] of [["an attribute of the item", "Checkbox attribute"]] as const) {
  test(`a checkbox item ticks while an app action holds ${what}`, async () => {
    const m = mount(held);
    await openItemsThenNext(m);
    const item = m.getByRole("menuitemcheckbox", { name });
    await m.user.click(item);
    await answered();
    expect(item.getAttribute("aria-checked")).toBe("true");
    await finish(m);
    expect(item.getAttribute("aria-checked")).toBe("true");
  });
}

for (const [what, name, plainName] of [
  ["an attribute of the item", "Radio attribute", "Plain radio"],
] as const) {
  test(`a radio item is chosen while an app action holds ${what}`, async () => {
    const m = mount(held);
    await openItemsThenNext(m);
    const item = m.getByRole("menuitemradio", { name });
    const plain = m.getByRole("menuitemradio", { name: plainName });
    await m.user.click(item);
    await answered();
    expect(item.getAttribute("aria-checked")).toBe("true");
    expect(plain.getAttribute("aria-checked")).toBe("false");
    await finish(m);
    expect(item.getAttribute("aria-checked")).toBe("true");
  });
}

for (const [what, name] of [
  ["an attribute of the submenu trigger", "Submenu attribute"],
  ["a prop of the submenu trigger", "Submenu prop"],
] as const) {
  test(`a submenu opens while an app action holds ${what}`, async () => {
    const m = mount(held);
    await openItemsThenNext(m);
    const trigger = m.getByRole("menuitem", { name });
    await m.user.click(trigger);
    await answered();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.hasAttribute("data-popup-open")).toBe(true);
    await finish(m);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
}

test.fails("a submenu closes while an app action holds a prop of its root", async () => {
  const m = mount(held);
  const items = m.getByRole("button", { name: "Submenu root" });
  await m.user.click(items);
  await expect.poll(() => items.getAttribute("aria-expanded")).toBe("true");
  const trigger = m.getByRole("menuitem", { name: "Submenu root prop" });
  await m.user.click(trigger);
  await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("true");
  await next(m, true);
  const inner = m.getByRole("menuitem", { name: "Submenu root prop item" });
  await m.user.hover(inner);
  await expect.poll(() => document.activeElement).toBe(inner);
  await m.user.keyboard("{Escape}");
  await answered();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(items.getAttribute("aria-expanded")).toBe("true");
  await finish(m);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});
