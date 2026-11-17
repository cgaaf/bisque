import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

const NATIVE = "Constraints not satisfied"; // jsdom's message for every native constraint failure

test("leaves native validation to the fields", () => {
  const { getByTestId } = mount(basic);
  expect((getByTestId("form") as HTMLFormElement).noValidate).toBe(true);
});

test("a submit with invalid fields is prevented, shows every error and focuses the first", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const prevented: boolean[] = [];
  const record = (event: Event) => prevented.push(event.defaultPrevented);
  window.addEventListener("submit", record);
  await user.click(getByRole("button", { name: "Submit" }));
  window.removeEventListener("submit", record);
  expect(prevented).toEqual([true]);
  expect(getByTestId("submitted").textContent).toBe("");
  expect(getByTestId("email-root").hasAttribute("data-invalid")).toBe(true);
  expect(getByTestId("email-error").textContent).toBe(NATIVE);
  expect(getByTestId("username-root").hasAttribute("data-invalid")).toBe(true);
  expect(document.activeElement).toBe(getByRole("textbox", { name: "Email" }));
});

test("after a submit attempt, fields validate on every change", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Submit" }));
  await user.type(getByRole("textbox", { name: "Email" }), "a@b.co");
  expect(queryByTestId("email-error")).toBeNull();
  expect(getByTestId("email-root").hasAttribute("data-valid")).toBe(true);

  const username = getByRole("textbox", { name: "Username" });
  await user.type(username, "admin");
  expect(getByTestId("username-error").textContent).toBe("That name is taken");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(document.activeElement).toBe(username);
  expect(getByTestId("submitted").textContent).toBe("");
});

test("before a submit attempt, fields don't validate on change", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.type(getByRole("textbox", { name: "Username" }), "admin");
  await user.tab();
  expect(getByTestId("username-root").hasAttribute("data-invalid")).toBe(false);
});

test("a valid submit calls onFormSubmit with the values of the named fields", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.type(getByRole("textbox", { name: "Email" }), "a@b.co");
  await user.type(getByRole("textbox", { name: "Username" }), "ada");
  const prevented: boolean[] = [];
  const record = (event: Event) => prevented.push(event.defaultPrevented);
  window.addEventListener("submit", record);
  await user.click(getByRole("button", { name: "Submit" }));
  window.removeEventListener("submit", record);
  expect(getByTestId("submitted").textContent).toBe("a@b.co|ada");
  // onFormSubmit takes the submission over from the browser.
  expect(prevented).toEqual([true]);
});

test("shows errors passed in, focuses their field after a submit, and clears one when its field changes", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  await user.type(getByRole("textbox", { name: "Email" }), "a@b.co");
  const username = getByRole("textbox", { name: "Username" });
  await user.type(username, "ada");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(document.activeElement).toBe(getByRole("button", { name: "Submit" }));

  await user.click(getByRole("button", { name: "Server error" }));
  expect(getByTestId("username-error").textContent).toBe("Already registered");
  expect(getByTestId("username-root").hasAttribute("data-invalid")).toBe(true);
  expect(username.getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(username);

  // A field with an error from the server blocks the next submit until it changes.
  await user.click(getByRole("button", { name: "Submit" }));
  expect(document.activeElement).toBe(username);
  await user.type(username, "2");
  expect(queryByTestId("username-error")).toBeNull();
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("a@b.co|ada2");
});

test("`validate` sees the other fields' values", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.type(getByRole("textbox", { name: "Email" }), "a@b.co");
  await user.type(getByRole("textbox", { name: "Username" }), "a@b.co");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("username-error").textContent).toBe("Pick a name other than your email");
  expect(getByTestId("submitted").textContent).toBe("");
});

test("the same server error shows again after the next submit", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  await user.type(getByRole("textbox", { name: "Email" }), "a@b.co");
  const username = getByRole("textbox", { name: "Username" });
  await user.type(username, "ada");
  await user.click(getByRole("button", { name: "Server error" }));
  expect(getByTestId("username-error").textContent).toBe("Already registered");
  await user.type(username, "2");
  expect(queryByTestId("username-error")).toBeNull();
  await user.click(getByRole("button", { name: "Submit" }));
  await user.click(getByRole("button", { name: "Server error" }));
  expect(getByTestId("username-error").textContent).toBe("Already registered");
});
