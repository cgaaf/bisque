// Lists whose order is saved to a server (fixtures/async.rx): the save succeeds, is refused, or is still out when
// the list is dragged again. The fake server holds every save until the test answers it.
import { afterEach, beforeEach, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { frame, mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import fixture from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

afterEach(async () => {
  await userEvent.pointer({ keys: "[/MouseLeft]" }).catch(() => undefined);
});

function rows(list: HTMLElement) {
  return [...list.querySelectorAll("li")].map((li) => li.getAttribute("data-bisque-sortable-item")).join(",");
}

async function setup() {
  const mounted = mount(fixture);
  const text = (id: string) => mounted.getByTestId(id).textContent;
  // Picks `id` up from the keyboard, moves it `steps` down and drops it.
  const move = async (name: string, steps: number) => {
    mounted.getByRole("button", { name }).focus();
    await mounted.user.keyboard(" ");
    // oxlint-disable-next-line no-await-in-loop -- each key moves from where the one before left it
    for (let i = 0; i < steps; i += 1) await mounted.user.keyboard("{ArrowDown}");
    await mounted.user.keyboard(" ");
    await answered();
  };
  return { ...mounted, text, move };
}

test("optimistic: the new order shows at once and stays when the server accepts it", async () => {
  const { getByTestId, text, move } = await setup();
  await move("Move one (guessed)", 1);
  expect(waiting()).toEqual(["guessed"]);
  expect(text("guessed-order")).toBe("two,one,three");
  expect(rows(getByTestId("guessed"))).toBe("two,one,three");
  release("guessed");
  await answered();
  expect(rows(getByTestId("guessed"))).toBe("two,one,three");
  expect(text("guessed-error")).toBe("");
});

test("optimistic: a refused order goes back, in the DOM too, and focus stays on the item", async () => {
  const { getByTestId, getByRole, text, move } = await setup();
  server.failing = ["guessed"];
  await move("Move one (guessed)", 2);
  expect(rows(getByTestId("guessed"))).toBe("two,three,one");
  release("guessed");
  await answered();
  expect(text("guessed-error")).toBe("refused");
  expect(text("guessed-order")).toBe("one,two,three");
  expect(rows(getByTestId("guessed"))).toBe("one,two,three");
  await expect.poll(() => document.activeElement).toBe(getByRole("button", { name: "Move one (guessed)" }));
});

test("optimistic: the list can be dragged again while a save is out", async () => {
  const { getByTestId, text, move } = await setup();
  await move("Move one (guessed)", 1);
  expect(waiting()).toEqual(["guessed"]);
  await move("Move three (guessed)", 0);
  // Picked up and dropped in place: nothing to save.
  expect(waiting()).toEqual(["guessed"]);
  getByTestId("guessed").querySelector<HTMLElement>("button")!.focus();
  await move("Move two (guessed)", 2);
  expect(rows(getByTestId("guessed"))).toBe("one,three,two");
  expect(waiting()).toEqual(["guessed", "guessed"]);
  release("guessed");
  release("guessed");
  await answered();
  expect(text("guessed-order")).toBe("one,three,two");
  expect(rows(getByTestId("guessed"))).toBe("one,three,two");
});

test("not optimistic: the list shows the owner's order until the server has the new one", async () => {
  const { getByTestId, text, move } = await setup();
  await move("Move one (saved)", 1);
  expect(waiting()).toEqual(["saved"]);
  expect(rows(getByTestId("saved"))).toBe("one,two,three");
  release("saved");
  await answered();
  expect(text("saved-order")).toBe("two,one,three");
  expect(rows(getByTestId("saved"))).toBe("two,one,three");
});

test("not optimistic: a refused order never shows", async () => {
  const { getByTestId, text, move } = await setup();
  server.failing = ["saved"];
  await move("Move one (saved)", 2);
  expect(rows(getByTestId("saved"))).toBe("one,two,three");
  release("saved");
  await answered();
  expect(text("saved-error")).toBe("refused");
  expect(rows(getByTestId("saved"))).toBe("one,two,three");
});

test("a mouse drag whose order the server refuses goes back", async () => {
  const { getByTestId, getByRole, text } = await setup();
  server.failing = ["guessed"];
  const handle = getByRole("button", { name: "Move three (guessed)" });
  const box = handle.getBoundingClientRect();
  const from = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  const moves = Array.from({ length: 8 }, (_, i) => ({
    coords: { x: from.x, y: from.y - ((i + 1) * 80) / 8 },
  }));
  await userEvent.pointer([{ coords: from }, { keys: "[MouseLeft>]" }, ...moves, { keys: "[/MouseLeft]" }]);
  await frame();
  expect(rows(getByTestId("guessed"))).toBe("three,one,two");
  release("guessed");
  await answered();
  expect(text("guessed-error")).toBe("refused");
  expect(rows(getByTestId("guessed"))).toBe("one,two,three");
});
