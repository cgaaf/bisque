// Table beside app actions that are still waiting for their server (fixtures/held.rx): an option computed from a
// held write, an `onSortingChange` that saves, and a server that sorts and pages (controlled state whose rows
// are a loading question of it). The table's own state must follow the user while a request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, releaseAll, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
  server.lists = {
    "page 0 ": ["Mira", "Otto"],
    "page 1 ": ["Ines", "Aldo"],
    "page 2 ": ["Bea", "Cleo"],
    "page 0 name:asc": ["Aldo", "Bea"],
    "page 1 name:asc": ["Cleo", "Ines"],
  };
});

async function setup() {
  const m = mount(held);
  release("page 0 ");
  await answered();
  const names = (table: string) =>
    [...m.getByTestId(table).querySelectorAll("tbody td:last-child")].map((cell) => cell.textContent);
  return { ...m, names };
}

test("the table's own state follows the user while an app action holds one of its options", async () => {
  const m = await setup();
  await m.user.click(m.getByRole("button", { name: "Next step" }));
  expect(waiting()).toEqual(["step"]);
  expect(m.getByTestId("step").textContent).toBe("1");

  await m.user.click(m.getByRole("button", { name: "Held name" }));
  await expect.poll(() => m.names("held")).toEqual(["Aldo", "Ines"]);
  await m.user.click(m.getByRole("checkbox", { name: "Held Aldo" }));
  await expect
    .poll(() => (m.getByRole("checkbox", { name: "Held Aldo" }) as HTMLInputElement).checked)
    .toBe(true);
  await m.user.click(m.getByRole("button", { name: "Held next" }));
  await expect.poll(() => m.names("held")).toEqual(["Mira", "Otto"]);
  // Descending, and back on the first page: a new sort resets the page.
  await m.user.click(m.getByRole("button", { name: "Held name" }));
  await expect.poll(() => m.names("held")).toEqual(["Otto", "Mira"]);

  expect(m.getByTestId("step").textContent).toBe("1");
  release("step");
  await answered();
  expect(m.getByTestId("step").textContent).toBe("2");
  expect(m.names("held")).toEqual(["Otto", "Mira"]);
});

test("the rows follow each press while the app's onSortingChange is still saving", async () => {
  const m = await setup();
  const trigger = m.getByRole("button", { name: "Saving name" });
  await m.user.click(trigger);
  await expect.poll(() => m.names("saving")).toEqual(["Aldo", "Ines", "Mira", "Otto"]);
  await m.user.click(trigger);
  await expect.poll(() => m.names("saving")).toEqual(["Otto", "Mira", "Ines", "Aldo"]);
  await m.user.click(trigger);
  await expect.poll(() => m.names("saving")).toEqual(["Mira", "Otto", "Ines", "Aldo"]);
  await m.user.click(trigger);
  await expect.poll(() => m.names("saving")).toEqual(["Aldo", "Ines", "Mira", "Otto"]);
  expect(waiting()).toEqual(["sorting 1", "sorting 1", "sorting 0", "sorting 1"]);
  releaseAll();
  await answered();
  expect(m.getByTestId("saved").textContent).toBe("name:asc");
  expect(m.names("saving")).toEqual(["Aldo", "Ines", "Mira", "Otto"]);
});

test("a server that sorts and pages: the controls follow the press, the rows follow the answer", async () => {
  const m = await setup();
  expect(m.names("remote")).toEqual(["Mira", "Otto"]);
  const header = () => m.getByRole("columnheader", { name: "Remote name" });

  const previous = m.getByRole("button", { name: "Remote previous" }) as HTMLButtonElement;
  expect(previous.disabled).toBe(true);
  await m.user.click(m.getByRole("button", { name: "Remote next" }));
  // The table's controls show the new page at once. A plain reader of the app's own source (the output)
  // waits for the rows, as the language has it.
  await expect.poll(() => previous.disabled).toBe(false);
  expect(waiting()).toEqual(["page 1 "]);
  // The previous page's rows stay until the answer.
  expect(m.names("remote")).toEqual(["Mira", "Otto"]);
  release("page 1 ");
  await answered();
  expect(m.names("remote")).toEqual(["Ines", "Aldo"]);
  expect(m.getByTestId("remote-page").textContent).toBe("2");

  // Sorting asks the server, and shows in the header at once.
  await m.user.click(m.getByRole("button", { name: "Remote name" }));
  await expect.poll(() => header().getAttribute("aria-sort")).toBe("ascending");
  expect(waiting()).toEqual(["page 1 name:asc"]);
  release("page 1 name:asc");
  await answered();
  expect(m.names("remote")).toEqual(["Cleo", "Ines"]);

  // The last page: three pages of two for six rows.
  await m.user.click(previous);
  await expect.poll(() => previous.disabled).toBe(true);
  release("page 0 name:asc");
  await answered();
  expect(m.names("remote")).toEqual(["Aldo", "Bea"]);
});
