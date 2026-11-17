// An Input beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and an attribute of the input is computed from it: what is typed must still reach the input's field while
// the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

test("an input follows typing while an app action holds one of its attributes", async () => {
  const { getByRole, getByTestId, user } = mount(held);
  const root = getByTestId("root");
  const input = getByRole<HTMLInputElement>("textbox", { name: "Attribute" });
  await user.click(getByRole("button", { name: "Next" }));
  expect(waiting()).toEqual(["step"]);
  expect(getByTestId("step").textContent).toBe("1");
  await user.click(input);
  await user.type(input, "bad");
  await answered();
  expect(root.hasAttribute("data-dirty")).toBe(true);
  expect(root.hasAttribute("data-filled")).toBe(true);
  expect(root.hasAttribute("data-invalid")).toBe(true);
  await user.tab();
  await answered();
  expect(root.hasAttribute("data-touched")).toBe(true);
  expect(getByTestId("step").textContent).toBe("1");
  release("step");
  await answered();
  expect(getByTestId("step").textContent).toBe("2");
  expect(root.hasAttribute("data-invalid")).toBe(true);
  expect(input.value).toBe("bad");
});
