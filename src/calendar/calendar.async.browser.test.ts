// Calendars whose day is saved to a server (fixtures/async.rx), as a setting that saves when it changes: the save
// succeeds, fails, is slow, and two saves cross. The fake server holds every save until the test answers it.
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
  const root = (id: string) => mounted.getByTestId(`${id}-root`);
  const day = (id: string, iso: string) =>
    root(id).querySelector<HTMLButtonElement>(`button[data-date="${iso}"]:not([data-outside-month])`)!;
  const selected = (id: string) =>
    [...root(id).querySelectorAll<HTMLButtonElement>("button[data-selected]")].map(
      (button) => button.dataset.date,
    );
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, day, selected, text };
}

test("optimistic save that succeeds: the day is selected at once, and stays", async () => {
  const { day, selected, text, user } = await setup();
  await user.click(day("due", "2030-05-20"));
  expect(selected("due")).toEqual(["2030-05-20"]);
  expect(text("due")).toBe("2030-05-20");
  expect(text("due-saving")).toBe("saving");
  expect(waiting()).toEqual(["2030-05-20"]);
  release("2030-05-20");
  await answered();
  expect(selected("due")).toEqual(["2030-05-20"]);
  expect(text("due-saving")).toBe("");
});

test("optimistic save that fails: back to the old day, with the error, and it can be changed again", async () => {
  const { day, selected, text, user } = await setup();
  await user.click(day("due", "2030-05-20"));
  refuse("2030-05-20");
  await answered();
  expect(selected("due")).toEqual(["2030-05-09"]);
  expect(text("due-error")).toBe("failed");
  await user.click(day("due", "2030-05-21"));
  expect(selected("due")).toEqual(["2030-05-21"]);
  expect(text("due-error")).toBe("");
  release("2030-05-21");
  await answered();
  expect(selected("due")).toEqual(["2030-05-21"]);
});

test("two optimistic saves in flight, answered out of order: the last choice wins", async () => {
  const { day, selected, text, user } = await setup();
  await user.click(day("due", "2030-05-20"));
  await user.click(day("due", "2030-05-22"));
  expect(selected("due")).toEqual(["2030-05-22"]);
  expect(waiting()).toEqual(["2030-05-20", "2030-05-22"]);
  release("2030-05-22");
  await answered();
  release("2030-05-20");
  await answered();
  expect(selected("due")).toEqual(["2030-05-22"]);
  expect(text("due")).toBe("2030-05-22");
});

test("the keyboard while a save is out: focus keeps moving, each choice is sent, the last one stays", async () => {
  const { day, selected, user } = await setup();
  day("due", "2030-05-09").focus();
  await user.keyboard("{ArrowRight}{Enter}");
  expect(selected("due")).toEqual(["2030-05-10"]);
  await user.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}{ArrowLeft}{Enter}");
  expect(document.activeElement).toBe(day("due", "2030-05-18"));
  expect(selected("due")).toEqual(["2030-05-18"]);
  expect(waiting()).toEqual(["2030-05-10", "2030-05-18"]);
  release("2030-05-18");
  release("2030-05-10");
  await answered();
  expect(selected("due")).toEqual(["2030-05-18"]);
});

test("a save that isn't optimistic: the old day stays selected until the owner has the new one", async () => {
  const { day, selected, text, user } = await setup();
  await user.click(day("start", "2030-05-20"));
  expect(selected("start")).toEqual(["2030-05-09"]);
  release("2030-05-20");
  await answered();
  expect(selected("start")).toEqual(["2030-05-20"]);
  expect(text("start")).toBe("2030-05-20");
  await user.click(day("start", "2030-05-21"));
  refuse("2030-05-21");
  await answered();
  expect(selected("start")).toEqual(["2030-05-20"]);
  expect(text("start-error")).toBe("failed");
});

test("disabled while saving: the day keeps focus, re-enables, and can be used again", async () => {
  const { day, selected, user } = await setup();
  day("review", "2030-05-09").focus();
  await user.keyboard("{ArrowRight}{Enter}");
  const pressed = day("review", "2030-05-10");
  expect(selected("review")).toEqual(["2030-05-10"]);
  expect(pressed.disabled).toBe(true);
  release("2030-05-10");
  await answered();
  expect(pressed.disabled).toBe(false);
  expect(document.activeElement).toBe(pressed);
  await user.keyboard("{ArrowRight}{Enter}");
  expect(selected("review")).toEqual(["2030-05-11"]);
  refuse("2030-05-11");
  await answered();
  expect(selected("review")).toEqual(["2030-05-10"]);
});

test("read-only while saving: keeps focus, ignores choices, and takes them again after", async () => {
  const { day, selected, user } = await setup();
  day("launch", "2030-05-09").focus();
  await user.keyboard("{ArrowRight}{Enter}");
  expect(selected("launch")).toEqual(["2030-05-10"]);
  await user.keyboard("{ArrowRight}{Enter}");
  expect(document.activeElement).toBe(day("launch", "2030-05-11"));
  expect(selected("launch")).toEqual(["2030-05-10"]);
  expect(waiting()).toEqual(["2030-05-10"]);
  release("2030-05-10");
  await answered();
  await user.keyboard("{Enter}");
  expect(selected("launch")).toEqual(["2030-05-11"]);
});

test("a range saved optimistically: completes at once, and a refused save puts the old range back", async () => {
  const { day, selected, text, user } = await setup();
  await user.click(day("stay", "2030-05-20"));
  await user.click(day("stay", "2030-05-22"));
  expect(selected("stay")).toEqual(["2030-05-20", "2030-05-21", "2030-05-22"]);
  expect(waiting()).toEqual(["2030-05-20/2030-05-22"]);
  refuse("2030-05-20/2030-05-22");
  await answered();
  expect(selected("stay")).toEqual(["2030-05-03", "2030-05-04", "2030-05-05"]);
  await user.click(day("stay", "2030-05-07"));
  await user.click(day("stay", "2030-05-06"));
  release("2030-05-06/2030-05-07");
  await answered();
  expect(text("stay")).toBe("2030-05-06/2030-05-07");
  expect(selected("stay")).toEqual(["2030-05-06", "2030-05-07"]);
});

test("a handler that writes what a loading question reads doesn't hold the calendar", async () => {
  const { day, selected, text, user } = await setup();
  server.holdLoads = true;
  await user.click(day("preview", "2030-05-20"));
  expect(selected("preview")).toEqual(["2030-05-20"]);
  expect(text("state")).toBe("2030-05-20");
  expect(text("preview")).toBe("2030-05-09");
  await user.click(day("preview", "2030-05-21"));
  await user.click(day("preview", "2030-05-22"));
  expect(selected("preview")).toEqual(["2030-05-22"]);
  expect(text("state")).toBe("2030-05-22");
  releaseLoads();
  await answered();
  expect(selected("preview")).toEqual(["2030-05-22"]);
  expect(text("preview")).toBe("2030-05-22");
});
