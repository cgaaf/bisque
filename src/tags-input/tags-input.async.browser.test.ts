// Tags inputs whose tags are saved to a server (fixtures/async.rx): the save succeeds, fails, is slow, and two saves
// cross. The fake server holds every save until the test answers it.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import {
  answered,
  refuse,
  release,
  releaseLoads,
  resetServer,
  server,
  waiting,
} from "../test/settings-server.ts";
import fixture from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

async function setup() {
  const mounted = mount(fixture);
  await answered();
  const tags = (testId: string) =>
    [...mounted.getByTestId(testId).querySelectorAll("[data-testid=tag] span")].map((tag) => tag.textContent);
  const input = (label: string) => mounted.getByRole<HTMLInputElement>("textbox", { name: label });
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, tags, input, text };
}

test("an optimistic save that succeeds: the tag shows at once, and stays", async () => {
  const { tags, input, text, user } = await setup();
  await user.click(input("Topics"));
  await user.keyboard("b{Enter}");
  expect(tags("topics")).toEqual(["a", "b"]);
  expect(input("Topics").value).toBe("");
  expect(text("topics-saving")).toBe("saving");
  expect(waiting()).toEqual([["a", "b"]]);
  release(["a", "b"]);
  await answered();
  expect(tags("topics")).toEqual(["a", "b"]);
  expect(text("topics-saving")).toBe("");
});

test("an optimistic save that fails: back to the old tags, with the error, and tags can be added again", async () => {
  const { tags, input, text, user } = await setup();
  await user.click(input("Topics"));
  await user.keyboard("b{Enter}");
  refuse(["a", "b"]);
  await answered();
  expect(tags("topics")).toEqual(["a"]);
  expect(text("topics-error")).toBe("failed");
  await user.keyboard("c{Enter}");
  expect(tags("topics")).toEqual(["a", "c"]);
  expect(text("topics-error")).toBe("");
  release(["a", "c"]);
  await answered();
  expect(tags("topics")).toEqual(["a", "c"]);
});

test("two optimistic saves in flight, answered out of order: the last change wins", async () => {
  const { tags, input, user } = await setup();
  await user.click(input("Topics"));
  await user.keyboard("b{Enter}c{Enter}");
  expect(tags("topics")).toEqual(["a", "b", "c"]);
  expect(waiting()).toEqual([
    ["a", "b"],
    ["a", "b", "c"],
  ]);
  release(["a", "b", "c"]);
  await answered();
  release(["a", "b"]);
  await answered();
  expect(tags("topics")).toEqual(["a", "b", "c"]);
});

test("typed into while a save is out: the answer doesn't overwrite the typed text", async () => {
  const { tags, input, user } = await setup();
  await user.click(input("Topics"));
  await user.keyboard("b{Enter}next");
  expect(input("Topics").value).toBe("next");
  release(["a", "b"]);
  await answered();
  expect(input("Topics").value).toBe("next");
  expect(tags("topics")).toEqual(["a", "b"]);
  await user.keyboard("{Enter}");
  expect(tags("topics")).toEqual(["a", "b", "next"]);
});

test("removal while a save is out is shown at once and saved after it", async () => {
  const { tags, input, user } = await setup();
  await user.click(input("Topics"));
  await user.keyboard("b{Enter}{Backspace}{Backspace}{Backspace}");
  expect(tags("topics")).toEqual([]);
  expect(waiting()).toEqual([["a", "b"], ["a"], []]);
  release(["a"]);
  release([]);
  release(["a", "b"]);
  await answered();
  expect(tags("topics")).toEqual([]);
});

test("a save that isn't optimistic: the owner's tags are shown until it has the new ones", async () => {
  const { tags, input, text, user } = await setup();
  await user.click(input("Labels"));
  await user.keyboard("b{Enter}");
  expect(tags("labels")).toEqual(["a"]);
  release(["a", "b"]);
  await answered();
  expect(tags("labels")).toEqual(["a", "b"]);
  await user.keyboard("c{Enter}");
  refuse(["a", "b", "c"]);
  await answered();
  expect(tags("labels")).toEqual(["a", "b"]);
  expect(text("labels-error")).toBe("failed");
});

test("disabled while saving: the input takes focus back and can be used again", async () => {
  const { tags, input, user } = await setup();
  await user.click(input("Colours"));
  await user.keyboard("red{Enter}");
  expect(tags("colours")).toEqual(["red"]);
  expect(input("Colours").disabled).toBe(true);
  release(["red"]);
  await answered();
  expect(input("Colours").disabled).toBe(false);
  expect(document.activeElement).toBe(input("Colours"));
  await user.keyboard("blue{Enter}");
  expect(tags("colours")).toEqual(["red", "blue"]);
  refuse(["red", "blue"]);
  await answered();
  expect(tags("colours")).toEqual(["red"]);
});

test("read-only while saving: keeps focus, adds nothing, and takes tags again after", async () => {
  const { tags, input, user } = await setup();
  await user.click(input("Sizes"));
  await user.keyboard("s{Enter}");
  expect(input("Sizes").readOnly).toBe(true);
  await user.keyboard("m{Enter}{Backspace}{Backspace}");
  expect(tags("sizes")).toEqual(["s"]);
  expect(waiting()).toEqual([["s"]]);
  release(["s"]);
  await answered();
  expect(document.activeElement).toBe(input("Sizes"));
  await user.keyboard("{Escape}m{Enter}");
  expect(tags("sizes")).toEqual(["s", "m"]);
});

test("a handler that writes what a loading question reads doesn't hold the tags", async () => {
  const { tags, input, text, user } = await setup();
  server.holdLoads = true;
  await user.click(input("Preview"));
  await user.keyboard("x{Enter}");
  expect(tags("preview-root")).toEqual(["x"]);
  expect(text("state")).toBe("x");
  expect(input("Preview").value).toBe("");
  await user.keyboard("y{Enter}z");
  expect(tags("preview-root")).toEqual(["x", "y"]);
  expect(input("Preview").value).toBe("z");
  releaseLoads();
  await answered();
  expect(tags("preview-root")).toEqual(["x", "y"]);
  expect(text("preview")).toBe("x|y");
  expect(input("Preview").value).toBe("z");
});
