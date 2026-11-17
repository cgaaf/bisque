import { expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";

type Box = HTMLInputElement;
const state = (box: Box) => (box.indeterminate ? "mixed" : box.checked ? "true" : "false");

test("each box is checked while the group's value holds its value", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  expect(getByRole("group", { name: "Toppings" })).toBe(getByTestId("toppings"));
  const cheese = getByRole("checkbox", { name: "Cheese" }) as Box;
  const ham = getByRole("checkbox", { name: "Ham" }) as Box;
  expect(cheese.checked).toBe(true);
  expect(ham.checked).toBe(false);

  await user.click(ham);
  expect(ham.checked).toBe(true);
  expect(getByTestId("last").textContent).toBe("cheese,ham");
  await user.click(cheese);
  expect(cheese.checked).toBe(false);
  expect(getByTestId("last").textContent).toBe("ham");
});

test("a box changes from its label and with Space", async () => {
  const { getByRole, getByText, getByTestId, user } = mount(basic);
  const olives = getByRole("checkbox", { name: "Olives" }) as Box;
  await user.click(getByText("Olives"));
  expect(olives.checked).toBe(true);
  olives.focus();
  await user.keyboard(" ");
  expect(olives.checked).toBe(false);
  expect(getByTestId("last").textContent).toBe("cheese");
});

test("submits each checked box's value under its name", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("checkbox", { name: "Olives" }));
  expect(new FormData(getByTestId("form") as HTMLFormElement).getAll("toppings")).toEqual([
    "cheese",
    "olives",
  ]);
});

test("the parent box is mixed while some are checked, and cycles all, none, then the mixed selection", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const all = getByRole("checkbox", { name: "All toppings" }) as Box;
  const boxes = ["Cheese", "Ham", "Olives"].map((name) => getByRole("checkbox", { name }) as Box);
  // `indeterminate` has no attribute: it is set on the element.
  expect(all.indeterminate).toBe(true);
  expect(all.matches(":indeterminate")).toBe(true);
  expect(all.hasAttribute("data-parent")).toBe(true);
  expect(all.name).toBe("");

  await user.click(all);
  expect(state(all)).toBe("true");
  expect(boxes.map(state)).toEqual(["true", "true", "true"]);
  await user.click(all);
  expect(state(all)).toBe("false");
  expect(boxes.map(state)).toEqual(["false", "false", "false"]);
  // The browser cleared `indeterminate` on the first press; the state sets it again.
  await user.click(all);
  expect(state(all)).toBe("mixed");
  expect(boxes.map(state)).toEqual(["true", "false", "false"]);
  expect(getByTestId("last").textContent).toBe("cheese");

  // Checking the rest by hand makes the parent checked, and the cycle starts from there.
  await user.click(boxes[1]);
  await user.click(boxes[2]);
  expect(state(all)).toBe("true");
  await user.click(all);
  expect(boxes.map(state)).toEqual(["false", "false", "false"]);
});

test("inside a field: labelled by it, its value is the field's, disabled with it", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const group = getByRole("group", { name: "Colors" });
  expect(group.hasAttribute("data-dirty")).toBe(false);
  await user.click(getByRole("checkbox", { name: "Blue" }));
  expect(getByTestId("colors-root").hasAttribute("data-dirty")).toBe(true);
  expect(group.hasAttribute("data-filled")).toBe(true);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe('["red","blue"]');

  expect((getByRole("checkbox", { name: "Small" }) as Box).disabled).toBe(true);
  expect(getByRole("group", { name: "Sizes" }).hasAttribute("data-disabled")).toBe(true);
});

test("a form reset returns an uncontrolled group to its default with one change", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const box = (name: string) => getByRole("checkbox", { name }) as HTMLInputElement;
  expect(box("Cheese").defaultChecked).toBe(true);
  await user.click(box("Ham"));
  await user.click(box("Olives"));
  expect(getByTestId("changes").textContent).toBe("2");
  (getByTestId("form") as HTMLFormElement).reset();
  expect(box("Cheese").checked).toBe(true);
  expect(box("Ham").checked).toBe(false);
  await expect.poll(() => getByTestId("last").textContent).toBe("cheese");
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(getByTestId("changes").textContent).toBe("3");
  expect(state(box("All toppings"))).toBe("mixed");
  // The parent box starts its cycle again from the default selection.
  await user.click(box("All toppings"));
  expect(getByTestId("last").textContent).toBe("cheese,ham,olives");
  await user.click(box("All toppings"));
  expect(getByTestId("last").textContent).toBe("");
  await user.click(box("All toppings"));
  expect(getByTestId("last").textContent).toBe("cheese");
});

test("a form reset keeps a controlled group at its owner's value", async () => {
  const { getByRole, user } = mount(basic);
  const box = (name: string) => getByRole("checkbox", { name }) as HTMLInputElement;
  await user.click(box("Blue"));
  expect(box("Blue").checked).toBe(true);
  await user.click(getByRole("button", { name: "Reset colors" }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(box("Red").checked).toBe(true);
  expect(box("Blue").checked).toBe(true);
});

test("a form reset returns a group's field to untouched", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const blue = getByRole("checkbox", { name: "Blue" }) as HTMLInputElement;
  await user.click(blue);
  blue.focus();
  await user.tab();
  const root = getByTestId("colors-root");
  expect(root.hasAttribute("data-touched")).toBe(true);
  await user.click(getByRole("button", { name: "Reset colors" }));
  await expect.poll(() => root.hasAttribute("data-touched")).toBe(false);
});
