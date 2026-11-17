import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";

const radio = (getByRole: (role: string, options: { name: string }) => HTMLElement, name: string) =>
  getByRole("radio", { name }) as HTMLInputElement;

test("native radios in a labelled radiogroup, checked on press and from their label", async () => {
  const { getByRole, getByTestId, getByText, user } = mount(basic);
  expect(getByRole("radiogroup", { name: "Fruit" })).toBeTruthy();
  const apple = radio(getByRole, "Apple");
  const banana = radio(getByRole, "Banana");
  expect(apple.type).toBe("radio");
  expect(apple.checked).toBe(true);
  const indicator = getByTestId("apple-indicator");
  expect(apple.nextElementSibling).toBe(indicator);
  expect(indicator.getAttribute("aria-hidden")).toBe("true");
  expect(indicator.matches("input:checked + span")).toBe(true);

  await user.click(banana);
  expect(banana.checked).toBe(true);
  expect(apple.checked).toBe(false);
  expect(indicator.matches("input:checked + span")).toBe(false);
  expect(getByTestId("fruit").textContent).toBe("banana");

  await user.click(getByText("Date"));
  expect(radio(getByRole, "Date").checked).toBe(true);
  expect(getByTestId("fruit").textContent).toBe("date");
});

test("the radios of a group share its name; a group without one gets a generated name", () => {
  const { getByRole } = mount(basic);
  expect(radio(getByRole, "Apple").name).toBe("fruit");
  expect(radio(getByRole, "Banana").name).toBe("fruit");
  const a = radio(getByRole, "A");
  expect(a.name).not.toBe("");
  expect(radio(getByRole, "B").name).toBe(a.name);
  expect(radio(getByRole, "X").name).not.toBe(a.name);
  // Inside a field, the field's name.
  expect(radio(getByRole, "Free").name).toBe("plan");
});

// Chromium and Firefox also wrap from the last radio to the first; WebKit stops at the ends, so wrapping isn't
// asserted.
test("the arrow keys move focus and check, skipping disabled radios", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const apple = radio(getByRole, "Apple");
  const banana = radio(getByRole, "Banana");
  const date = radio(getByRole, "Date");
  apple.focus();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(banana);
  expect(banana.checked).toBe(true);
  expect(getByTestId("fruit").textContent).toBe("banana");
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(date);
  expect(date.checked).toBe(true);
  expect(getByTestId("fruit").textContent).toBe("date");
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(banana);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(apple);
  expect(apple.checked).toBe(true);
  expect(banana.checked).toBe(false);
  expect(getByTestId("fruit").textContent).toBe("apple");
});

test("the group is one Tab stop: Tab from the checked radio leaves the group", async () => {
  const { getByRole, user } = mount(basic);
  const apple = radio(getByRole, "Apple");
  apple.focus();
  await user.tab();
  // Where focus lands depends on the system's keyboard settings in Safari and Firefox; that it left is certain.
  const fruit = getByRole("radiogroup", { name: "Fruit" });
  expect(fruit.contains(document.activeElement)).toBe(false);
});

test("Space checks the focused radio; Enter doesn't", async () => {
  const { getByRole, user } = mount(basic);
  const small = radio(getByRole, "Small");
  small.focus();
  await user.keyboard("{Enter}");
  expect(small.checked).toBe(false);
  await user.keyboard(" ");
  expect(small.checked).toBe(true);
});

test("disabled radios are natively disabled; a read-only group lets focus move but checks nothing", async () => {
  const { getByRole, user } = mount(basic);
  const cherry = radio(getByRole, "Cherry");
  expect(cherry.disabled).toBe(true);
  expect(cherry.matches(":disabled")).toBe(true);

  const locked = getByRole("radiogroup", { name: "Locked" });
  expect(locked.getAttribute("aria-readonly")).toBe("true");
  const a = radio(getByRole, "A");
  const b = radio(getByRole, "B");
  await user.click(b);
  expect(b.checked).toBe(false);
  expect(a.checked).toBe(true);
  a.focus();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(b);
  expect(b.checked).toBe(false);
  expect(a.checked).toBe(true);
});

test("controlled: an owner that refuses the change keeps its radio checked", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const x = radio(getByRole, "X");
  const y = radio(getByRole, "Y");
  await user.click(y);
  await frame();
  expect(getByTestId("refusals").textContent).toBe("1");
  expect(x.checked).toBe(true);
  expect(y.checked).toBe(false);
  x.focus();
  await user.keyboard("{ArrowDown}");
  await frame();
  expect(getByTestId("refusals").textContent).toBe("2");
  expect(x.checked).toBe(true);
});

test("submits the checked value under its name", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const form = getByTestId("form") as HTMLFormElement;
  expect(new FormData(form).get("fruit")).toBe("apple");
  expect(new FormData(form).get("size")).toBeNull();
  await user.click(radio(getByRole, "Large"));
  expect(new FormData(form).get("size")).toBe("l");
  // A group without a name submits under the generated one.
  expect(new FormData(form).get(radio(getByRole, "A").name)).toBe("a");
});

test("inside a field: labelled and validated by it; a submit focuses the first radio", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const group = getByRole("radiogroup", { name: "Plan" });
  const free = radio(getByRole, "Free");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("plan-error").textContent).toBe("Choose a plan");
  expect(group.getAttribute("aria-invalid")).toBe("true");
  expect(free.validity.valueMissing).toBe(true);
  expect(document.activeElement).toBe(free);

  const root = getByTestId("plan-root");
  expect(root.hasAttribute("data-focused")).toBe(true);
  await user.keyboard("{ArrowDown}");
  expect(radio(getByRole, "Pro").checked).toBe(true);
  expect(queryByTestId("plan-error")).toBeNull();
  // Moving between radios keeps the field focused; leaving the group blurs and touches it.
  expect(root.hasAttribute("data-focused")).toBe(true);
  expect(root.hasAttribute("data-touched")).toBe(false);
  radio(getByRole, "Pro").blur();
  await frame();
  expect(root.hasAttribute("data-focused")).toBe(false);
  expect(root.hasAttribute("data-touched")).toBe(true);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("plan=pro");
});

test("inside a field, a submit focuses the checked radio", async () => {
  const { getByRole, user } = mount(basic);
  const pro = radio(getByRole, "Pro");
  await user.click(pro);
  // Valid now: break it from outside so the submit focuses the group again.
  pro.setCustomValidity("Not this one");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(document.activeElement).toBe(pro);
});

test("a form reset returns an uncontrolled group to its default with one change, and keeps a controlled one", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const tea = radio(getByRole, "Tea");
  expect(tea.defaultChecked).toBe(true);
  expect(radio(getByRole, "Coffee").defaultChecked).toBe(false);
  await user.click(radio(getByRole, "Coffee"));
  await user.click(radio(getByRole, "Banana"));
  expect(getByTestId("drink-changes").textContent).toBe("coffee");
  (getByTestId("form") as HTMLFormElement).reset();
  // The browser's reset alone already checks the default.
  expect(tea.checked).toBe(true);
  await expect.poll(() => getByTestId("drink-changes").textContent).toBe("coffee,tea");
  await expect.poll(() => radio(getByRole, "Banana").checked).toBe(true);
  await frame();
  expect(radio(getByRole, "Apple").checked).toBe(false);
  expect(tea.checked).toBe(true);
  expect(getByTestId("fruit").textContent).toBe("banana");
  expect(getByTestId("drink-changes").textContent).toBe("coffee,tea");
});

test("a form reset clears a group that has no default", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(radio(getByRole, "Large"));
  expect(radio(getByRole, "Large").checked).toBe(true);
  (getByTestId("form") as HTMLFormElement).reset();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(radio(getByRole, "Small").checked).toBe(false);
  expect(radio(getByRole, "Large").checked).toBe(false);
  expect(new FormData(getByTestId("form") as HTMLFormElement).get("size")).toBeNull();
});
