// A checkbox group beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a
// plain write, and a prop of the group is computed from it: which boxes the parent box checks must still follow the
// user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

test("the parent box checks and clears them all while an app action holds a prop of the group", async () => {
  const { getByRole, getByTestId, user } = mount(held);
  const all = getByRole<HTMLInputElement>("checkbox", { name: "All" });
  const p = getByRole<HTMLInputElement>("checkbox", { name: "Box p" });
  const q = getByRole<HTMLInputElement>("checkbox", { name: "Box q" });
  await user.click(getByRole("button", { name: "Next" }));
  expect(waiting()).toEqual(["step"]);
  await user.click(all);
  await answered();
  expect(all.checked).toBe(true);
  expect(p.checked).toBe(true);
  expect(q.checked).toBe(true);
  // In either order: the parent checks `allValues` as the app is about to pass it, already ["q", "p"].
  expect(getByTestId("parent").textContent.split(",").toSorted()).toEqual(["p", "q"]);
  await user.click(all);
  await answered();
  expect(all.checked).toBe(false);
  expect(p.checked).toBe(false);
  expect(getByTestId("parent").textContent).toBe("");
  await user.click(q);
  await answered();
  expect(all.indeterminate).toBe(true);
  expect(getByTestId("step").textContent).toBe("1");
  release("step");
  await answered();
  expect(getByTestId("step").textContent).toBe("2");
  expect(q.checked).toBe(true);
  expect(all.indeterminate).toBe(true);
  expect(getByTestId("parent").textContent).toBe("q");
});
