// Listboxes whose selection is saved to a server (fixtures/async.rx), as a setting that saves when it changes: the
// save succeeds, fails, is slow, and two saves cross; and a listbox whose options arrive from the server after it
// mounts. The fake server holds every save until the test answers it.
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
  const option = (list: string, name: string) =>
    mounted
      .getByRole("listbox", { name: list })
      .querySelector(`[role=option][data-value="${name}"]`) as HTMLElement;
  const selected = (list: string) =>
    [
      ...mounted.getByRole("listbox", { name: list }).querySelectorAll("[role=option][aria-selected=true]"),
    ].map((element) => element.getAttribute("data-value"));
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, option, selected, text };
}

test("optimistic save that succeeds: selected at once, and stays", async () => {
  const { option, selected, text, user } = await setup();
  await user.click(option("Plan", "pro"));
  expect(selected("Plan")).toEqual(["pro"]);
  expect(text("plan-saving")).toBe("saving");
  expect(waiting()).toEqual(["pro"]);
  release("pro");
  await answered();
  expect(selected("Plan")).toEqual(["pro"]);
  expect(text("plan")).toBe("pro");
  expect(text("plan-saving")).toBe("");
});

test("optimistic save that fails: back to the old option, with the error, and it can be changed again", async () => {
  const { option, selected, text, user } = await setup();
  await user.click(option("Plan", "pro"));
  refuse("pro");
  await answered();
  expect(selected("Plan")).toEqual(["free"]);
  expect(text("plan-error")).toBe("failed");
  await user.click(option("Plan", "team"));
  expect(selected("Plan")).toEqual(["team"]);
  expect(text("plan-error")).toBe("");
  release("team");
  await answered();
  expect(selected("Plan")).toEqual(["team"]);
});

test("two optimistic saves in flight, answered out of order: the last choice wins", async () => {
  const { option, selected, text, user } = await setup();
  await user.click(option("Plan", "pro"));
  await user.click(option("Plan", "team"));
  expect(selected("Plan")).toEqual(["team"]);
  expect(waiting()).toEqual(["pro", "team"]);
  release("team");
  await answered();
  release("pro");
  await answered();
  expect(selected("Plan")).toEqual(["team"]);
  expect(text("plan")).toBe("team");
});

test("the keyboard while saves are out: each choice shows and is sent, and the last one stays", async () => {
  const { option, selected, text, user } = await setup();
  option("Plan", "free").focus();
  await user.keyboard("{ArrowDown}{ }");
  expect(selected("Plan")).toEqual(["pro"]);
  await user.keyboard("{ArrowDown}{ }");
  expect(selected("Plan")).toEqual(["team"]);
  await user.keyboard("{ArrowUp}{ArrowUp}{ArrowDown}{ArrowDown}");
  expect(document.activeElement).toBe(option("Plan", "team"));
  expect(waiting()).toEqual(["pro", "team"]);
  release("team");
  release("pro");
  await answered();
  expect(selected("Plan")).toEqual(["team"]);
  expect(text("plan")).toBe("team");
});

test("a save that isn't optimistic: the old option stays selected until the owner has the new value", async () => {
  const { option, selected, text, user } = await setup();
  await user.click(option("Shipping", "express"));
  expect(selected("Shipping")).toEqual(["standard"]);
  release("express");
  await answered();
  expect(selected("Shipping")).toEqual(["express"]);
  await user.click(option("Shipping", "standard"));
  refuse("standard");
  await answered();
  expect(selected("Shipping")).toEqual(["express"]);
  expect(text("shipping-error")).toBe("failed");
});

test("disabled while saving: then enabled again, and usable", async () => {
  const { getByRole, option, selected, user } = await setup();
  const list = getByRole("listbox", { name: "Theme" });
  await user.click(option("Theme", "dark"));
  expect(selected("Theme")).toEqual(["dark"]);
  expect(list.getAttribute("aria-disabled")).toBe("true");
  release("dark");
  await answered();
  expect(list.hasAttribute("aria-disabled")).toBe(false);
  await user.click(option("Theme", "light"));
  expect(selected("Theme")).toEqual(["light"]);
  refuse("light");
  await answered();
  expect(selected("Theme")).toEqual(["dark"]);
});

test("multiple, optimistic: toggles show at once and the last list wins; a failure puts the list back", async () => {
  const { option, selected, text, user } = await setup();
  await user.click(option("Tags", "sport"));
  await user.click(option("Tags", "weather"));
  expect(selected("Tags")).toEqual(["news", "sport", "weather"]);
  expect(waiting()).toEqual([
    ["news", "sport"],
    ["news", "sport", "weather"],
  ]);
  release(["news", "sport", "weather"]);
  await answered();
  release(["news", "sport"]);
  await answered();
  expect(selected("Tags")).toEqual(["news", "sport", "weather"]);
  expect(text("tags")).toBe("news,sport,weather");
  await user.click(option("Tags", "news"));
  expect(selected("Tags")).toEqual(["sport", "weather"]);
  refuse(["sport", "weather"]);
  await answered();
  expect(selected("Tags")).toEqual(["news", "sport", "weather"]);
  expect(text("tags-error")).toBe("failed");
});

test("a handler that writes what a loading question reads doesn't hold the listbox", async () => {
  const { option, selected, text, user } = await setup();
  server.holdLoads = true;
  await user.click(option("Preview", "y"));
  expect(selected("Preview")).toEqual(["y"]);
  expect(text("state")).toBe("y");
  expect(text("preview")).toBe("x");
  expect(text("previewing")).toBe("loading");
  await user.click(option("Preview", "x"));
  await user.click(option("Preview", "y"));
  expect(selected("Preview")).toEqual(["y"]);
  expect(text("state")).toBe("y");
  releaseLoads();
  await answered();
  expect(selected("Preview")).toEqual(["y"]);
  expect(text("preview")).toBe("y");
});

test("options that arrive late: the chosen value submits meanwhile, and is the Tab stop once they are there", async () => {
  server.holdLoads = true;
  const { getByRole, getByTestId, user } = mount(fixture);
  const list = getByRole("listbox", { name: "Fruit" });
  const form = getByTestId("form") as HTMLFormElement;
  expect(list.querySelectorAll("[role=option]").length).toBe(0);
  expect(new FormData(form).getAll("fruit")).toEqual(["cherry"]);
  releaseLoads();
  await answered();
  expect(list.querySelectorAll("[role=option]").length).toBe(3);
  await expect.poll(() => list.querySelector("[tabindex='0']")?.getAttribute("data-value")).toBe("cherry");
  await user.click(getByRole("option", { name: "banana" }));
  expect(new FormData(form).getAll("fruit")).toEqual(["banana"]);
});

test("a failed load of the options is the app's to show", async () => {
  server.failingLoads = ["fruits"];
  const { getByTestId } = mount(fixture);
  await answered();
  expect(getByTestId("fruits-error").textContent).toBe("Couldn't load fruits");
  expect(new FormData(getByTestId("form") as HTMLFormElement).getAll("fruit")).toEqual(["cherry"]);
});
