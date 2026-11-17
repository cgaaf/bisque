// Inputs used against a server (fixtures/async.rx): typing while an answer the value asks for is out, and an
// input saved as it changes.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, releaseLoads, resetServer, server, waiting } from "../test/settings-server.ts";
import fixture from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

async function setup() {
  const mounted = mount(fixture);
  await answered();
  return { ...mounted, text: (id: string) => mounted.getByTestId(id).textContent };
}

test("a controlled input whose value a loading question reads keeps every keystroke", async () => {
  const { getByRole, text, user } = await setup();
  server.holdLoads = true;
  const name = getByRole("textbox", { name: "Name" }) as HTMLInputElement;
  await user.click(name);
  await user.keyboard("ada");
  expect(name.value).toBe("ada");
  releaseLoads();
  await answered();
  expect(name.value).toBe("ada");
  expect(text("check")).toBe("ada");
});

test("an uncontrolled input whose handler writes what a loading question reads isn't held by it", async () => {
  const { getByRole, getByTestId, text, user } = await setup();
  server.holdLoads = true;
  const query = getByRole("textbox", { name: "Query" }) as HTMLInputElement;
  await user.click(query);
  await user.keyboard("pe");
  expect(query.value).toBe("pe");
  // The field's state follows the input at once, while the app's question is still loading.
  expect(getByTestId("query-root").hasAttribute("data-filled")).toBe(true);
  expect(getByTestId("query-root").hasAttribute("data-dirty")).toBe(true);
  releaseLoads();
  await answered();
  expect(query.value).toBe("pe");
  expect(text("found")).toBe("pe");
});

test("an input saved optimistically on every change keeps every keystroke", async () => {
  const { getByRole, user } = await setup();
  const bio = getByRole("textbox", { name: "Bio" }) as HTMLInputElement;
  await user.click(bio);
  await user.keyboard("hey");
  expect(bio.value).toBe("hey");
  expect(waiting()).toEqual(["h", "he", "hey"]);
  release("he");
  await answered();
  expect(bio.value).toBe("hey");
  release("h");
  release("hey");
  await answered();
  expect(bio.value).toBe("hey");
});
