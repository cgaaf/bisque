import { expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import slow from "./fixtures/async.rx";
import basic from "./fixtures/basic.rx";

const textbox = (getByRole: (role: string, options: { name: string }) => HTMLElement, name: string) =>
  getByRole("textbox", { name }) as HTMLInputElement;

function recordSubmits(form: HTMLElement): boolean[] {
  const prevented: boolean[] = [];
  // Bubble phase on the document: after the form's own handler has decided.
  const record = (event: Event) => {
    if (event.target === form) prevented.push(event.defaultPrevented);
  };
  document.addEventListener("submit", record);
  return prevented;
}

test("leaves native validation to the fields", () => {
  const { getByTestId } = mount(basic);
  expect((getByTestId("form") as HTMLFormElement).noValidate).toBe(true);
});

test("a submit with invalid fields is prevented, shows every error and focuses the first", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const prevented = recordSubmits(getByTestId("form"));
  await user.click(getByRole("button", { name: "Submit" }));
  expect(prevented).toEqual([true]);
  expect(getByTestId("submitted").textContent).toBe("");
  const email = textbox(getByRole, "Email");
  expect(getByTestId("email-root").hasAttribute("data-invalid")).toBe(true);
  expect(getByTestId("email-error").textContent).toBe(email.validationMessage);
  expect(email.validity.valueMissing).toBe(true);
  // The browser counts a submit attempt as interaction, novalidate or not.
  expect(email.matches(":user-invalid")).toBe(true);
  expect(getByTestId("username-root").hasAttribute("data-invalid")).toBe(true);
  expect(document.activeElement).toBe(email);
});

test("after a submit attempt, fields validate on every change", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Submit" }));
  await user.type(textbox(getByRole, "Email"), "a@b.co");
  expect(queryByTestId("email-error")).toBeNull();
  expect(getByTestId("email-root").hasAttribute("data-valid")).toBe(true);

  const username = textbox(getByRole, "Username");
  await user.type(username, "admin");
  expect(getByTestId("username-error").textContent).toBe("That name is taken");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(document.activeElement).toBe(username);
  expect(getByTestId("submitted").textContent).toBe("");
});

test("before a submit attempt, fields don't validate on change", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.type(textbox(getByRole, "Username"), "admin");
  await user.tab();
  expect(getByTestId("username-root").hasAttribute("data-invalid")).toBe(false);
});

test("a valid submit calls onFormSubmit with the values of the named fields", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.type(textbox(getByRole, "Email"), "a@b.co");
  await user.type(textbox(getByRole, "Username"), "ada");
  const prevented = recordSubmits(getByTestId("form"));
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("a@b.co|ada");
  // onFormSubmit takes the submission over from the browser.
  expect(prevented).toEqual([true]);
});

test("Enter in a field submits the form", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.type(textbox(getByRole, "Email"), "a@b.co");
  await user.type(textbox(getByRole, "Username"), "ada{Enter}");
  expect(getByTestId("submitted").textContent).toBe("a@b.co|ada");
});

test("shows errors passed in, focuses their field after a submit, and clears one when its field changes", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  await user.type(textbox(getByRole, "Email"), "a@b.co");
  const username = textbox(getByRole, "Username");
  await user.type(username, "ada");
  // Submitted from the keyboard: Safari doesn't focus a clicked button.
  getByRole("button", { name: "Submit" }).focus();
  await user.keyboard("{Enter}");
  expect(getByTestId("submitted").textContent).toBe("a@b.co|ada");
  expect(document.activeElement).toBe(getByRole("button", { name: "Submit" }));

  getByRole("button", { name: "Server error" }).focus();
  await user.keyboard("{Enter}");
  expect(getByTestId("username-error").textContent).toBe("Already registered");
  expect(getByTestId("username-root").hasAttribute("data-invalid")).toBe(true);
  expect(username.getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(username);

  // A field with an error from the server blocks the next submit until it changes.
  await user.click(getByRole("button", { name: "Submit" }));
  expect(document.activeElement).toBe(username);
  // Focusing an invalid field selects its text: collapse it to the end before typing (End does nothing in a text
  // input on macOS in Firefox and WebKit).
  await user.keyboard("{ArrowRight}2");
  expect(queryByTestId("username-error")).toBeNull();
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("a@b.co|ada2");
});

test("`validate` sees the other fields' values", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.type(textbox(getByRole, "Email"), "a@b.co");
  await user.type(textbox(getByRole, "Username"), "a@b.co");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("username-error").textContent).toBe("Pick a name other than your email");
  expect(getByTestId("submitted").textContent).toBe("");
});

test("the same server error shows again after the next submit", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  await user.type(textbox(getByRole, "Email"), "a@b.co");
  const username = textbox(getByRole, "Username");
  await user.type(username, "ada");
  await user.click(getByRole("button", { name: "Server error" }));
  expect(getByTestId("username-error").textContent).toBe("Already registered");
  await user.type(username, "2");
  expect(queryByTestId("username-error")).toBeNull();
  await user.click(getByRole("button", { name: "Submit" }));
  await user.click(getByRole("button", { name: "Server error" }));
  expect(getByTestId("username-error").textContent).toBe("Already registered");
});

// The fixture's server answers after 150ms.
async function submitSlow(username: string) {
  const mounted = mount(slow);
  const field = textbox(mounted.getByRole, "Username");
  await mounted.user.type(field, username);
  await mounted.user.keyboard("{Enter}");
  return { ...mounted, field, form: mounted.getByTestId("form") };
}

test("a handler that awaits keeps the form submitting until it ends", async () => {
  const { form, getByTestId } = await submitSlow("ada");
  expect(form.hasAttribute("data-submitting")).toBe(true);
  expect(form.getAttribute("aria-busy")).toBe("true");
  expect(getByTestId("saved").textContent).toBe("");
  await expect.poll(() => getByTestId("saved").textContent).toBe("ada");
  expect(form.hasAttribute("data-submitting")).toBe(false);
  expect(form.hasAttribute("aria-busy")).toBe(false);
});

test("a submit while one is out is ignored: the handler runs once", async () => {
  const { form, getByTestId, user } = await submitSlow("ada");
  const prevented = recordSubmits(form);
  await user.keyboard("{Enter}");
  await user.keyboard("{Enter}");
  expect(prevented).toEqual([true, true]);
  await expect.poll(() => getByTestId("saved").textContent).toBe("ada");
  expect(getByTestId("calls").textContent).toBe("1");
});

test("errors the handler resolves to show on their fields and take focus", async () => {
  const { form, field, getByTestId, queryByTestId, getByRole, user } = await submitSlow("taken");
  // Focus is elsewhere when the answer lands.
  textbox(getByRole, "City").focus();
  await expect.poll(() => queryByTestId("username-error")?.textContent).toBe("Already registered");
  expect(form.hasAttribute("data-submitting")).toBe(false);
  expect(field.getAttribute("aria-invalid")).toBe("true");
  await expect.poll(() => document.activeElement).toBe(field);
  expect(getByTestId("saved").textContent).toBe("");

  // Changing the value retires the error; the same value refused again shows it again.
  await user.keyboard("{ArrowRight}2");
  expect(queryByTestId("username-error")).toBeNull();
  await user.keyboard("{Backspace}{Enter}");
  await expect.poll(() => queryByTestId("username-error")?.textContent).toBe("Already registered");
  expect(getByTestId("calls").textContent).toBe("2");
  await expect.poll(() => document.activeElement).toBe(field);
});

test("an error for a field edited while the request was out is dropped", async () => {
  const { form, field, getByTestId, queryByTestId, user } = await submitSlow("taken");
  expect(form.hasAttribute("data-submitting")).toBe(true);
  await user.type(field, "2");
  await expect.poll(() => form.hasAttribute("data-submitting")).toBe(false);
  expect(getByTestId("calls").textContent).toBe("1");
  expect(queryByTestId("username-error")).toBeNull();
  expect(field.value).toBe("taken2");
});

test("a failed request ends the submit, and the form can be sent again", async () => {
  const { form, field, getByTestId, user } = await submitSlow("offline");
  await expect.poll(() => getByTestId("failure").textContent).toBe("Network down");
  expect(form.hasAttribute("data-submitting")).toBe(false);
  await user.clear(field);
  await user.type(field, "ada{Enter}");
  await expect.poll(() => getByTestId("saved").textContent).toBe("ada");
  expect(getByTestId("failure").textContent).toBe("");
});

test("fields stay live while a submit is out", async () => {
  const { form, getByRole, getByTestId, user } = await submitSlow("ada");
  expect(form.hasAttribute("data-submitting")).toBe(true);
  const city = getByTestId("city-root");
  expect(city.hasAttribute("data-filled")).toBe(false);
  await user.type(textbox(getByRole, "City"), "Oslo");
  // Still out, and the field has already taken the typing in.
  expect(form.hasAttribute("data-submitting")).toBe(true);
  expect(city.hasAttribute("data-filled")).toBe(true);
  expect(city.hasAttribute("data-dirty")).toBe(true);
  await expect.poll(() => getByTestId("saved").textContent).toBe("ada");
});
