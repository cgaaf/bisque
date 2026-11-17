// Number fields whose value is saved to a server (fixtures/async.rx): the app saves what is committed, the save
// succeeds, fails, is slow, saves cross, the field is typed into while one is out. The fake server holds every save
// until the test answers it.
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
  const input = (name: string) => mounted.getByLabelText(name) as HTMLInputElement;
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, input, text };
}

test("an optimistic save from the stepper: shows at once, and stays", async () => {
  const { getByTestId, input, text, user } = await setup();
  await user.click(getByTestId("quantity-increment"));
  expect(input("Quantity").value).toBe("2");
  expect(waiting()).toEqual([2]);
  expect(text("quantity-saving")).toBe("saving");
  release(2);
  await answered();
  expect(input("Quantity").value).toBe("2");
  expect(text("quantity-saving")).toBe("");
});

test("two stepper saves answered out of order: the last choice wins", async () => {
  const { getByTestId, input, user } = await setup();
  await user.click(getByTestId("quantity-increment"));
  await user.click(getByTestId("quantity-increment"));
  expect(input("Quantity").value).toBe("3");
  expect(waiting()).toEqual([2, 3]);
  release(3);
  await answered();
  expect(input("Quantity").value).toBe("3");
  release(2);
  await answered();
  expect(input("Quantity").value).toBe("3");
});

test("an optimistic save that fails: the text goes back, and the field takes keys again", async () => {
  const { input, text, user } = await setup();
  input("Quantity").focus();
  await user.keyboard("{ArrowUp}");
  expect(input("Quantity").value).toBe("2");
  refuse(2);
  await answered();
  expect(input("Quantity").value).toBe("1");
  expect(text("quantity-error")).toBe("failed");
  await user.keyboard("{ArrowUp}");
  expect(input("Quantity").value).toBe("2");
  release(2);
  await answered();
  expect(input("Quantity").value).toBe("2");
});

test("typed into while a save is out: the answer doesn't overwrite the typed text", async () => {
  const { getByTestId, input, user } = await setup();
  await user.click(getByTestId("quantity-increment"));
  await user.tripleClick(input("Quantity"));
  await user.keyboard("7");
  expect(input("Quantity").value).toBe("7");
  release(2);
  await answered();
  expect(input("Quantity").value).toBe("7");
  await user.keyboard("{Tab}");
  expect(waiting()).toEqual([7]);
  expect(input("Quantity").value).toBe("7");
  release(7);
  await answered();
  expect(input("Quantity").value).toBe("7");
});

test("a save that fails while the field is being typed into leaves the typed text alone", async () => {
  const { input, user } = await setup();
  input("Quantity").focus();
  await user.keyboard("{ArrowUp}");
  await user.tripleClick(input("Quantity"));
  await user.keyboard("9");
  refuse(2);
  await answered();
  expect(input("Quantity").value).toBe("9");
  await user.keyboard("{Tab}");
  expect(waiting()).toEqual([9]);
  release(9);
  await answered();
  expect(input("Quantity").value).toBe("9");
});

test("a save that isn't optimistic: the field shows the owner's value, and ends on it", async () => {
  const { input, text, user } = await setup();
  input("Seats").focus();
  await user.keyboard("{ArrowUp}");
  await frame();
  // The owner hasn't taken 2 yet: the field shows its 1 until it does.
  expect(input("Seats").value).toBe("1");
  expect(waiting()).toEqual([2]);
  release(2);
  await answered();
  expect(text("seats")).toBe("2");
  expect(input("Seats").value).toBe("2");
  await user.keyboard("{ArrowUp}");
  await frame();
  expect(input("Seats").value).toBe("2");
  refuse(3);
  await answered();
  expect(input("Seats").value).toBe("2");
  expect(text("seats-error")).toBe("failed");
});

test("an optimistic save shows the new value without going back to the old one on the way", async () => {
  const { getByTestId, input, user } = await setup();
  const writes = recordWrites(input("Quantity"), "value");
  await user.click(getByTestId("quantity-increment"));
  await frame();
  expect(input("Quantity").value).toBe("2");
  release(2);
  await answered();
  expect(input("Quantity").value).toBe("2");
  expect(writes).not.toContain("1");
});

test("the plainest optimistic save (guess, save, write) succeeds and fails", async () => {
  const { input, user } = await setup();
  input("Guests").focus();
  await user.keyboard("{ArrowUp}");
  expect(input("Guests").value).toBe("2");
  release(2);
  await answered();
  expect(input("Guests").value).toBe("2");
  await user.keyboard("{ArrowUp}");
  expect(input("Guests").value).toBe("3");
  refuse(3);
  await answered();
  expect(input("Guests").value).toBe("2");
});

test("disabled while saving: the input takes focus back and keys work again", async () => {
  const { input, user } = await setup();
  const rooms = input("Rooms");
  rooms.focus();
  await user.keyboard("{ArrowUp}");
  expect(rooms.value).toBe("2");
  expect(rooms.disabled).toBe(true);
  release(2);
  await answered();
  expect(rooms.disabled).toBe(false);
  expect(document.activeElement).toBe(rooms);
  await user.keyboard("{ArrowUp}");
  expect(rooms.value).toBe("3");
  release(3);
  await answered();
});

test("read-only while saving: keeps focus, ignores keys, and takes them again after", async () => {
  const { input, user } = await setup();
  const nights = input("Nights");
  nights.focus();
  await user.keyboard("{ArrowUp}");
  expect(nights.value).toBe("2");
  expect(nights.readOnly).toBe(true);
  await user.keyboard("{ArrowUp}");
  expect(nights.value).toBe("2");
  expect(waiting()).toEqual([2]);
  release(2);
  await answered();
  expect(nights.readOnly).toBe(false);
  expect(document.activeElement).toBe(nights);
  await user.keyboard("{ArrowUp}");
  expect(nights.value).toBe("3");
  release(3);
  await answered();
});

test("a controlled field whose value a loading question reads keeps the typed text", async () => {
  const { input, text, user } = await setup();
  server.holdLoads = true;
  await user.tripleClick(input("Count"));
  await user.keyboard("12");
  expect(input("Count").value).toBe("12");
  expect(text("estimating")).toBe("loading");
  releaseLoads();
  await answered();
  expect(input("Count").value).toBe("12");
  expect(text("estimate")).toBe("12");
});

test("a handler that writes what a loading question reads doesn't hold the field", async () => {
  const { getByTestId, input, text, user } = await setup();
  server.holdLoads = true;
  const increment = getByTestId("preview-increment");
  await user.click(increment);
  await user.click(increment);
  await user.click(increment);
  expect(input("Preview").value).toBe("4");
  expect(text("preview")).toBe("1");
  releaseLoads();
  await answered();
  expect(input("Preview").value).toBe("4");
  expect(text("preview")).toBe("4");
});
