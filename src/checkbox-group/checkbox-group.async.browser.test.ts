// Checkbox groups whose value is saved to a server (fixtures/async.rx): the save succeeds, fails, is slow, a box is
// pressed while another box's save is out, and the parent box saves every box at once. The fake server holds every
// save until the test answers it.
import { beforeEach, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import {
  answered,
  recordWrites,
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

// Mounted, with the settings loaded.
async function setup() {
  const mounted = mount(fixture);
  await answered();
  const box = (name: string) => mounted.getByRole("checkbox", { name }) as HTMLInputElement;
  const checked = (group: string) =>
    [...mounted.getByRole("group", { name: group }).querySelectorAll<HTMLInputElement>("input:checked")]
      .map((input) => input.value)
      .filter((value) => value !== "on");
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, box, checked, text };
}

test("optimistic save that succeeds: the box is checked at once, and stays", async () => {
  const { box, checked, text, user } = await setup();
  const writes = recordWrites(box("Olives"), "checked");
  await user.click(box("Olives"));
  expect(checked("Toppings")).toEqual(["olives"]);
  expect(text("toppings-saving")).toBe("saving");
  expect(box("All toppings").indeterminate).toBe(true);
  release(["olives"]);
  await answered();
  expect(checked("Toppings")).toEqual(["olives"]);
  expect(text("toppings-saving")).toBe("");
  expect(writes).not.toContain(false);
});

test("a box pressed while another box's save is out: both show, and the last value sent stays", async () => {
  const { box, checked, text, user } = await setup();
  await user.click(box("Cheese"));
  await user.click(box("Basil"));
  // Responsive throughout: the second press showed at once, on top of the first.
  expect(checked("Toppings")).toEqual(["cheese", "basil"]);
  expect(waiting()).toEqual([["cheese"], ["cheese", "basil"]]);
  release(["cheese", "basil"]);
  await answered();
  expect(checked("Toppings")).toEqual(["cheese", "basil"]);
  release(["cheese"]);
  await answered();
  expect(checked("Toppings")).toEqual(["cheese", "basil"]);
  expect(text("toppings")).toBe("cheese,basil");
});

test("optimistic save that fails: the boxes go back, with the error, and can be changed again", async () => {
  const { box, checked, text, user } = await setup();
  await user.click(box("Cheese"));
  refuse(["cheese"]);
  await answered();
  expect(checked("Toppings")).toEqual([]);
  expect(box("Cheese").checked).toBe(false);
  expect(text("toppings-error")).toBe("failed");
  await user.click(box("Olives"));
  expect(checked("Toppings")).toEqual(["olives"]);
  expect(text("toppings-error")).toBe("");
});

test("the parent box saves every box at once, and a failure clears them all again", async () => {
  const { box, checked, user } = await setup();
  const all = box("All toppings");
  await user.click(all);
  expect(checked("Toppings")).toEqual(["cheese", "olives", "basil"]);
  expect(all.checked).toBe(true);
  expect(waiting()).toEqual([["cheese", "olives", "basil"]]);
  refuse(["cheese", "olives", "basil"]);
  await answered();
  expect(checked("Toppings")).toEqual([]);
  expect(all.checked).toBe(false);
  expect(all.indeterminate).toBe(false);
});

test("a save that isn't optimistic: the box shows the owner's value, then the saved one", async () => {
  const { box, checked, text, user } = await setup();
  await user.click(box("Sunday"));
  await frame();
  expect(box("Sunday").checked).toBe(false);
  expect(text("days")).toBe("");
  release(["sun"]);
  await answered();
  expect(checked("Days")).toEqual(["sun"]);
});

test("a handler that writes what a loading question reads doesn't hold the group", async () => {
  const { box, text, user } = await setup();
  server.holdLoads = true;
  await user.click(box("Red"));
  expect(box("Red").checked).toBe(true);
  expect(text("state")).toBe("red");
  await user.click(box("Blue"));
  expect(box("Blue").checked).toBe(true);
  expect(text("state")).toBe("red,blue");
  await user.click(box("Red"));
  expect(box("Red").checked).toBe(false);
  expect(text("state")).toBe("blue");
  releaseLoads();
  await answered();
  expect(box("Red").checked).toBe(false);
  expect(box("Blue").checked).toBe(true);
  expect(text("preview")).toBe("1");
});

test("many presses in a row, each saving: every box stays live and the last value stays", async () => {
  const { box, checked, user } = await setup();
  // oxlint-disable-next-line no-await-in-loop -- presses one after another, as a person makes them
  for (const name of ["Cheese", "Olives", "Basil", "Olives", "Cheese", "Basil"]) await user.click(box(name));
  expect(checked("Toppings")).toEqual([]);
  expect(waiting()).toHaveLength(6);
  // Answered newest first, one at a time: answered all at once, each save's `refresh` would cut off the one
  // before it, which Solid reports (ABANDONED_FLIGHTS) as the app's to debounce.
  for (const value of waiting().toReversed()) {
    release(value);
    // oxlint-disable-next-line no-await-in-loop -- one answer at a time is the point
    await answered();
  }
  expect(checked("Toppings")).toEqual([]);
  await user.click(box("Olives"));
  expect(checked("Toppings")).toEqual(["olives"]);
});
