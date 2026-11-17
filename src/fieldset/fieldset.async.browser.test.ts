// A section of a form locked while its save is out (fixtures/async.rx): `disabled={pending? stored}`.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, refuse, release, resetServer, server, waiting } from "../test/settings-server.ts";
import fixture from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

test("disabled while its save is out; the control that had focus gets it back", async () => {
  const { getByRole, getByTestId, user } = mount(fixture);
  await answered();
  const group = getByRole("group", { name: "Address" }) as HTMLFieldSetElement;
  const city = getByRole("textbox", { name: "City" }) as HTMLInputElement;
  const button = getByRole("button", { name: "Save" });
  await user.click(city);
  await user.keyboard("Lyon");
  button.focus();
  await user.keyboard("{Enter}");
  expect(waiting()).toEqual(["Lyon"]);
  expect(group.disabled).toBe(true);
  expect(city.matches(":disabled")).toBe(true);
  release("Lyon");
  await answered();
  expect(group.disabled).toBe(false);
  expect(getByTestId("stored").textContent).toBe("Lyon");
  expect(city.value).toBe("Lyon");
  expect(document.activeElement).toBe(button);
  // Again, failing this time: it is enabled again with the text kept.
  await user.keyboard("{Enter}");
  expect(group.disabled).toBe(true);
  refuse("Lyon");
  await answered();
  expect(group.disabled).toBe(false);
  expect(city.value).toBe("Lyon");
  expect(document.activeElement).toBe(button);
});
