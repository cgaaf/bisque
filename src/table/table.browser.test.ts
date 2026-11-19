// Table in Chromium, Firefox and WebKit: TanStack Table's core driving a native <table>.
import { expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import tree from "./fixtures/features.rx";
import minimal from "./fixtures/minimal.rx";

function setup() {
  const view = mount(basic);
  const names = () =>
    [...view.container.querySelectorAll("tbody tr")].map(
      (row) => row.querySelector("td:nth-child(2)")!.textContent,
    );
  const header = (name: string) => view.getByRole("columnheader", { name });
  const box = (name: string) => view.getByRole("checkbox", { name }) as HTMLInputElement;
  return { ...view, names, header, box };
}

test("renders the first page with native table semantics", () => {
  const { names, getAllByRole, header } = setup();
  expect(names()).toEqual(["Mira", "Otto", "Ines"]);
  // The header row and three body rows; four columns.
  expect(getAllByRole("row")).toHaveLength(4);
  expect(getAllByRole("columnheader")).toHaveLength(4);
  expect(header("Name").getAttribute("scope")).toBe("col");
  expect(header("Name").hasAttribute("aria-sort")).toBe(false);
});

test("the sort trigger cycles ascending, descending, unsorted", async () => {
  const { names, header, getByRole, user } = setup();
  const trigger = getByRole("button", { name: "Name" });
  await user.click(trigger);
  expect(names()).toEqual(["Aldo", "Bea", "Ines"]);
  expect(header("Name").getAttribute("aria-sort")).toBe("ascending");
  expect(trigger.getAttribute("data-sorted")).toBe("asc");
  await user.click(trigger);
  expect(names()).toEqual(["Otto", "Mira", "Ines"]);
  expect(header("Name").getAttribute("aria-sort")).toBe("descending");
  await user.click(trigger);
  expect(names()).toEqual(["Mira", "Otto", "Ines"]);
  expect(header("Name").hasAttribute("aria-sort")).toBe(false);
});

test("the sort trigger works from the keyboard, and Shift adds a column", async () => {
  const { names, header, getByRole, user } = setup();
  getByRole("button", { name: "Team" }).focus();
  await user.keyboard("{Enter}");
  expect(names()).toEqual(["Mira", "Ines", "Bea"]);
  await user.click(getByRole("button", { name: "Age" }), { modifiers: ["Shift"] });
  // Within the team, by age; the core sorts a column of numbers largest first.
  expect(names()).toEqual(["Mira", "Ines", "Bea"]);
  expect(header("Team").getAttribute("aria-sort")).toBe("ascending");
  expect(header("Age").getAttribute("aria-sort")).toBe("descending");
  expect(getByRole("button", { name: "Age" }).getAttribute("data-sort-index")).toBe("1");
});

test("a row keeps its element when the rows are sorted", async () => {
  const { getByTestId, getByRole, user } = setup();
  const row = getByTestId("c");
  await user.click(getByRole("button", { name: "Name" }));
  expect(getByTestId("c")).toBe(row);
});

test("selecting rows", async () => {
  const { box, getByTestId, user } = setup();
  const all = box("Select all rows");
  await user.click(box("Select Otto"));
  expect(box("Select Otto").checked).toBe(true);
  expect(getByTestId("b").hasAttribute("data-selected")).toBe(true);
  expect(getByTestId("count").textContent).toBe("1");
  expect(all.indeterminate).toBe(true);
  expect(all.checked).toBe(false);

  await user.click(all);
  expect(getByTestId("count").textContent).toBe("5");
  expect(all.checked).toBe(true);
  expect(all.indeterminate).toBe(false);
  await user.click(all);
  expect(getByTestId("count").textContent).toBe("0");
  expect(box("Select Otto").checked).toBe(false);
});

test("Shift selects the range from the last row pressed", async () => {
  const { box, getByTestId, user } = setup();
  await user.click(box("Select Mira"));
  await user.click(box("Select Ines"), { modifiers: ["Shift"] });
  expect(getByTestId("count").textContent).toBe("3");
  expect(box("Select Otto").checked).toBe(true);
});

test("a selection checkbox works from the keyboard", async () => {
  const { box, getByTestId, user } = setup();
  box("Select Mira").focus();
  await user.keyboard(" ");
  expect(getByTestId("count").textContent).toBe("1");
  expect(box("Select Mira").checked).toBe(true);
});

test("the global filter searches the columns that allow it and goes back to the first page", async () => {
  const { names, getByRole, user } = setup();
  await user.click(getByRole("button", { name: "Next" }));
  expect(names()).toEqual(["Aldo", "Bea"]);
  await user.fill(getByRole("searchbox", { name: "Search" }), "o");
  await expect.poll(names).toEqual(["Mira", "Otto", "Ines"]);
  await user.fill(getByRole("searchbox", { name: "Search" }), "ot");
  await expect.poll(names).toEqual(["Otto"]);
  // Age is left out of the search.
  await user.fill(getByRole("searchbox", { name: "Search" }), "41");
  await expect.poll(names).toEqual([]);
  await user.clear(getByRole("searchbox", { name: "Search" }));
  await expect.poll(names).toEqual(["Mira", "Otto", "Ines"]);
});

test("a column filter keeps the rows its column matches, and the input keeps what is typed", async () => {
  const { names, getByRole, user } = setup();
  const input = getByRole("textbox", { name: "Team filter" }) as HTMLInputElement;
  await user.click(input);
  await user.keyboard("sou");
  await expect.poll(names).toEqual(["Otto", "Aldo"]);
  expect(input.value).toBe("sou");
  expect(input.hasAttribute("data-filtered")).toBe(true);
});

test("hiding a column removes its header and cells", async () => {
  const { getAllByRole, getByRole, getByTestId, user } = setup();
  await user.click(getByRole("checkbox", { name: "Show age" }));
  expect(getAllByRole("columnheader")).toHaveLength(3);
  expect(getByTestId("a").querySelectorAll("td")).toHaveLength(3);
  await user.click(getByRole("checkbox", { name: "Show age" }));
  expect(getAllByRole("columnheader")).toHaveLength(4);
});

test("pagination follows the table's pages", async () => {
  const { names, getByRole, user } = setup();
  // The root's attributes are passed on to the <nav>.
  expect(getByRole("navigation", { name: "Pages of people" }).className).toBe("pager");
  const previous = getByRole("button", { name: "Previous" }) as HTMLButtonElement;
  const next = getByRole("button", { name: "Next" }) as HTMLButtonElement;
  expect(previous.disabled).toBe(true);
  await user.click(next);
  expect(names()).toEqual(["Aldo", "Bea"]);
  expect(next.disabled).toBe(true);
  await user.click(previous);
  expect(names()).toEqual(["Mira", "Otto", "Ines"]);
});

test("the table follows data held in a source: a removed row, and a changed field", async () => {
  const { names, getByRole, getByTestId, user } = setup();
  const otto = getByTestId("b");
  await user.click(getByRole("button", { name: "Age Otto" }));
  expect(getByTestId("b").querySelector("td:last-child")!.textContent).toBe("99");
  // Loop over ids: the row's element outlives the new row objects the core made for the new data.
  expect(getByTestId("b")).toBe(otto);
  await user.click(getByRole("button", { name: "Remove Mira" }));
  expect(names()).toEqual(["Otto", "Ines", "Aldo"]);
  expect(getByTestId("b")).toBe(otto);
});

function features() {
  const view = mount(tree);
  const ids = () =>
    [...view.container.querySelectorAll("tbody tr")].map((row) => row.getAttribute("data-testid"));
  return { ...view, ids };
}

test("controlled sorting held in a source: the handler gets the value, and the owner decides", async () => {
  const { ids, getByRole, getByTestId, user } = features();
  expect(ids()).toEqual(["docs", "src", "readme"]);
  expect(getByRole("columnheader", { name: /Size/ }).getAttribute("aria-sort")).toBe("descending");
  await user.click(getByRole("button", { name: "Name" }));
  await expect.poll(() => getByTestId("log").textContent).toBe("name:asc");
  await expect.poll(ids).toEqual(["docs", "readme", "src"]);
  // A source written from outside reaches the table, though the source is the same store throughout.
  await user.click(getByRole("button", { name: "Clear sorting" }));
  expect(ids()).toEqual(["src", "docs", "readme"]);
  // An owner that doesn't write the new state keeps the table where it was.
  await user.click(getByRole("button", { name: "Refuse" }));
  await user.click(getByRole("button", { name: "Size" }));
  await expect.poll(() => getByTestId("log").textContent).toBe("size:desc");
  expect(ids()).toEqual(["src", "docs", "readme"]);
  expect(getByRole("columnheader", { name: /Size/ }).hasAttribute("aria-sort")).toBe(false);
});

test("the expand trigger shows and hides sub-rows", async () => {
  const { ids, getByRole, getByTestId, user } = features();
  const trigger = getByRole("button", { name: "Toggle src" }) as HTMLButtonElement;
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  await user.click(trigger);
  expect(ids()).toEqual(["docs", "src", "src/b", "src/a", "readme"]);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(getByTestId("src").hasAttribute("data-expanded")).toBe(true);
  expect(getByTestId("src/a").getAttribute("data-depth")).toBe("1");
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(ids()).toEqual(["docs", "src", "readme"]);
  // A row with nothing under it.
  const leaf = getByRole("button", { name: "Toggle readme.md" }) as HTMLButtonElement;
  expect(leaf.disabled).toBe(true);
  expect(leaf.hasAttribute("aria-expanded")).toBe(false);
});

test("selecting a parent selects its sub-rows, and some of them makes it mixed", async () => {
  const { getByRole, user } = features();
  await user.click(getByRole("button", { name: "Toggle src" }));
  const parent = getByRole("checkbox", { name: "Select src" }) as HTMLInputElement;
  const child = getByRole("checkbox", { name: "Select a.ts" }) as HTMLInputElement;
  await user.click(parent);
  expect(child.checked).toBe(true);
  await user.click(child);
  expect(child.checked).toBe(false);
  await expect.poll(() => parent.indeterminate).toBe(true);
});

test("the resizer is a separator that resizes from the keyboard, within the column's limits", async () => {
  const { getByRole, getByTestId, user } = features();
  const handle = getByRole("separator", { name: "Resize Name" });
  const header = getByRole("columnheader", { name: /Name/ });
  expect(handle.getAttribute("aria-valuenow")).toBe("200");
  expect(handle.getAttribute("aria-valuemin")).toBe("100");
  expect(handle.getAttribute("aria-valuemax")).toBe("300");
  expect(handle.style.touchAction).toBe("none");
  expect(header.style.getPropertyValue("--column-size")).toBe("200px");
  handle.focus();
  await user.keyboard("{ArrowRight}");
  expect(handle.getAttribute("aria-valuenow")).toBe("210");
  expect(header.style.getPropertyValue("--column-size")).toBe("210px");
  expect(getByTestId("docs").querySelector("td")!.style.getPropertyValue("--column-size")).toBe("210px");
  await user.keyboard("{ArrowLeft}{ArrowLeft}");
  expect(handle.getAttribute("aria-valuenow")).toBe("190");
  await user.keyboard("{End}");
  expect(handle.getAttribute("aria-valuenow")).toBe("300");
  await user.keyboard("{ArrowRight}");
  expect(handle.getAttribute("aria-valuenow")).toBe("300");
  await user.keyboard("{Home}");
  expect(handle.getAttribute("aria-valuenow")).toBe("100");
  await user.dblClick(handle);
  expect(handle.getAttribute("aria-valuenow")).toBe("200");
});

test("dragging the resizer resizes the column", async () => {
  const { getByRole } = features();
  const handle = getByRole("separator", { name: "Resize Name" });
  // The core listens for the mouse on the document; dispatched, so the drag is the same in all three engines.
  handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 100 }));
  document.dispatchEvent(new MouseEvent("mousemove", { clientX: 140 }));
  await expect.poll(() => handle.getAttribute("aria-valuenow")).toBe("240");
  expect(handle.hasAttribute("data-resizing")).toBe(true);
  document.dispatchEvent(new MouseEvent("mouseup", { clientX: 140 }));
  await expect.poll(() => handle.hasAttribute("data-resizing")).toBe(false);
  expect(handle.getAttribute("aria-valuenow")).toBe("240");
});

test("a column that can't be resized has a disabled handle, and a pinned column says where it is pinned", () => {
  const { getByRole } = features();
  const handle = getByRole("separator", { name: "Resize Size" });
  expect(handle.getAttribute("aria-disabled")).toBe("true");
  expect(handle.hasAttribute("tabindex")).toBe(false);
  const name = getByRole("columnheader", { name: /Name/ });
  expect(name.getAttribute("data-pinned")).toBe("start");
  expect(name.style.getPropertyValue("--column-start")).toBe("0px");
});

test("a table with a feature set of its own: the parts leave out what the missing features would say", async () => {
  const { container, getByRole, user } = mount(minimal);
  const names = () => [...container.querySelectorAll("tbody td")].map((cell) => cell.textContent);
  expect(names()).toEqual(["Mira", "Otto", "Ines"]);
  await user.click(getByRole("button", { name: "Name" }));
  expect(names()).toEqual(["Ines", "Mira", "Otto"]);
  expect(getByRole("columnheader").getAttribute("aria-sort")).toBe("ascending");
  const row = container.querySelector("tbody tr")!;
  expect(row.hasAttribute("data-selected")).toBe(false);
  // No sizing feature, so no size to pass on.
  expect(container.querySelector("td")!.style.getPropertyValue("--column-size")).toBe("");
});
