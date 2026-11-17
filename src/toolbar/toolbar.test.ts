import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

test("is a toolbar with its orientation, and parts carry state attributes", () => {
  const { getByRole, getByTestId } = mount(basic);
  const bar = getByRole("toolbar", { name: "Format" });
  expect(bar).toBe(getByTestId("toolbar"));
  expect(bar.getAttribute("aria-orientation")).toBe("horizontal");
  expect(bar.getAttribute("data-orientation")).toBe("horizontal");
  expect(bar.className).toBe("mine");
  expect(bar.hasAttribute("data-disabled")).toBe(false);

  const undo = getByRole("button", { name: "Undo" });
  expect(undo.getAttribute("type")).toBe("button");
  expect(undo.getAttribute("data-orientation")).toBe("horizontal");
  expect(undo.hasAttribute("data-focusable")).toBe(true);

  const sep = getByTestId("sep");
  expect(sep.getAttribute("role")).toBe("separator");
  expect(sep.getAttribute("aria-orientation")).toBe("vertical");
  expect(getByTestId("vsep").getAttribute("aria-orientation")).toBe("horizontal");

  const group = getByTestId("group");
  expect(group.getAttribute("role")).toBe("group");
  expect(group.hasAttribute("data-disabled")).toBe(true);
  expect(getByRole("link", { name: "Help" }).getAttribute("data-orientation")).toBe("horizontal");
});

test("one Tab stop; the arrow keys visit every focusable item and wrap", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const undo = getByRole("button", { name: "Undo" });
  getByRole("button", { name: "Before" }).focus();
  await user.tab();
  expect(document.activeElement).toBe(undo);
  await user.tab();
  expect(document.activeElement).toBe(getByRole("button", { name: "After" }));
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(undo);

  const order = [
    getByRole("button", { name: "Redo" }),
    getByRole("button", { name: "Left" }),
    getByRole("button", { name: "Right" }),
    getByRole("button", { name: "Grouped" }),
    getByTestId("span"),
    getByRole("link", { name: "Help" }),
    getByRole("textbox", { name: "Search" }),
  ];
  for (const item of order) {
    // Each key press depends on where the last one left focus.
    // oxlint-disable-next-line no-await-in-loop
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(item);
  }
  // From the input, ArrowRight leaves only from the end of the text: the caret starts there here.
  (document.activeElement as HTMLInputElement).setSelectionRange(3, 3);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(undo);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(order[order.length - 1]);
});

test("in the input the arrow keys and Home/End move the caret until it reaches an edge", async () => {
  const { getByRole, user } = mount(basic);
  const input = getByRole("textbox", { name: "Search" }) as HTMLInputElement;
  input.focus();
  input.setSelectionRange(1, 1);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(0);
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(input);
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(input);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(getByRole("link", { name: "Help" }));
});

test("a disabled button stays focusable but inert; focusableWhenDisabled={false} takes it out", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const redo = getByRole("button", { name: "Redo" }) as HTMLButtonElement;
  expect(redo.disabled).toBe(false);
  expect(redo.getAttribute("aria-disabled")).toBe("true");
  expect(redo.hasAttribute("data-disabled")).toBe(true);
  expect(redo.hasAttribute("data-focusable")).toBe(true);
  redo.focus();
  await user.keyboard("{Enter}");
  await user.click(redo);
  expect(getByTestId("log").textContent).toBe("");

  const cut = getByRole("button", { name: "Cut" }) as HTMLButtonElement;
  expect(cut.disabled).toBe(true);
  expect(cut.hasAttribute("data-focusable")).toBe(false);

  const grouped = getByRole("button", { name: "Grouped" });
  expect(grouped.getAttribute("aria-disabled")).toBe("true");
});

test("buttons run the consumer's handler; the props work on a non-button element", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Undo" }));
  expect(getByTestId("log").textContent).toBe("u");
  const span = getByTestId("span");
  expect(span.getAttribute("role")).toBe("button");
  expect(span.getAttribute("tabindex")).toBe("-1");
});

test("a toggle group inside is part of the toolbar's focus order, not its own", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  expect(getByTestId("toggles").hasAttribute("data-bisque-list")).toBe(false);
  const left = getByRole("button", { name: "Left" });
  const right = getByRole("button", { name: "Right" });
  expect(left.getAttribute("tabindex")).toBe("-1");
  left.focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(right);
  await user.keyboard(" ");
  expect(right.getAttribute("aria-pressed")).toBe("true");
  expect(left.getAttribute("aria-pressed")).toBe("false");
  // Home and End aren't toolbar keys.
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(right);
});

test("vertical: ArrowDown and ArrowUp move, and stop at the ends without loopFocus", async () => {
  const { getByRole, user } = mount(basic);
  const bar = getByRole("toolbar", { name: "Side" });
  expect(bar.getAttribute("aria-orientation")).toBe("vertical");
  const one = getByRole("button", { name: "Up one" });
  const two = getByRole("button", { name: "Up two" });
  one.focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(one);
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(two);
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(two);
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(one);
});

test("a disabled toolbar disables its items, which stay reachable", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  expect(getByTestId("disabled").hasAttribute("data-disabled")).toBe(true);
  const one = getByRole("button", { name: "Off one" });
  const input = getByRole("textbox", { name: "Off input" }) as HTMLInputElement;
  expect(one.getAttribute("aria-disabled")).toBe("true");
  expect(one.getAttribute("tabindex")).toBe("0");
  expect(input.getAttribute("aria-disabled")).toBe("true");
  expect(input.disabled).toBe(false);
  one.focus();
  await user.keyboard("{Enter}");
  expect(getByTestId("log").textContent).toBe("");
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(input);
  await user.keyboard("abc");
  expect(input.value).toBe("");
});
