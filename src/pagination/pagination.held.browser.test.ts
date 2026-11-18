// Pagination beside app actions that are still waiting for their server (fixtures/held.rx): an `onPageChange` that
// fetches the page, a prop or attribute computed from a held write, a controlled owner that waits and refuses, and
// a controlled page whose rows are loading. The current page must follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, releaseAll, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const current = (root: Element) => root.querySelector("[aria-current='page']")?.textContent;

async function setup() {
  const m = mount(held);
  // The first page's rows.
  release("rows 1");
  await answered();
  return m;
}

// Four presses in a row: Next three times, then a page.
async function pressFour(m: Awaited<ReturnType<typeof setup>>, prefix: string, root: HTMLElement) {
  const next = m.getByTestId(`${prefix}-next`);
  for (const n of [2, 3, 4]) {
    // oxlint-disable-next-line no-await-in-loop -- each press acts on the page the one before left
    await m.user.click(next);
    // oxlint-disable-next-line no-await-in-loop
    await expect.poll(() => current(root)).toBe(`${n}`);
  }
  await m.user.click(m.getByTestId(`${prefix}-5`));
  await expect.poll(() => current(root)).toBe("5");
}

test("the page follows each press while the app's onPageChange is still fetching", async () => {
  const m = await setup();
  const root = m.getByTestId("fetching");
  await pressFour(m, "f", root);
  expect(waiting()).toEqual(["page 2", "page 3", "page 4", "page 5"]);
  releaseAll();
  await answered();
  expect(m.getByTestId("requested").textContent).toBe("5");
  expect(current(root)).toBe("5");
});

for (const [what, prefix] of [
  ["a prop of the root", "rp"],
  ["an attribute of the items", "ia"],
] as const) {
  test(`the page follows each press while an app action holds ${what}`, async () => {
    const m = await setup();
    const root = m.getByTestId(prefix === "rp" ? "root-prop" : "item-attribute");
    await m.user.click(m.getByRole("button", { name: "Next step" }));
    expect(waiting()).toEqual(["step"]);
    expect(m.getByTestId("step").textContent).toBe("1");
    await pressFour(m, prefix, root);
    expect(m.getByTestId("step").textContent).toBe("1");
    release("step");
    await answered();
    expect(m.getByTestId("step").textContent).toBe("2");
    expect(current(root)).toBe("5");
  });
}

test("controlled: an owner that waits on its server and refuses keeps the page", async () => {
  const m = await setup();
  const root = m.getByTestId("refused");
  expect(current(root)).toBe("3");
  await m.user.click(m.getByTestId("r-next"));
  await m.user.click(m.getByTestId("r-5"));
  await answered();
  expect(waiting()).toEqual(["refuse 4", "refuse 5"]);
  expect(current(root)).toBe("3");
  releaseAll();
  await answered();
  expect(current(root)).toBe("3");
});

test("controlled: the page follows each press while the new page's rows load", async () => {
  const m = await setup();
  const root = m.getByTestId("loading");
  expect(m.getByTestId("rows").textContent).toBe("rows 1 one,rows 1 two,rows 1 three");
  await m.user.click(m.getByTestId("l-next"));
  await expect.poll(() => current(root)).toBe("2");
  expect(waiting()).toEqual(["rows 2"]);
  release("rows 2");
  await answered();
  expect(m.getByTestId("rows").textContent).toBe("rows 2 one,rows 2 two,rows 2 three");
  expect(current(root)).toBe("2");
  // Four more presses, two at a time while the rows are still out. (More unanswered at once is an app asking and
  // discarding, which Solid reports as ABANDONED_FLIGHTS: the app's to fix, by debouncing.)
  await m.user.click(m.getByTestId("l-next"));
  await expect.poll(() => current(root)).toBe("3");
  await m.user.click(m.getByTestId("l-next"));
  await expect.poll(() => current(root)).toBe("4");
  expect(m.getByTestId("rows").textContent).toBe("rows 2 one,rows 2 two,rows 2 three");
  releaseAll();
  await answered();
  expect(m.getByTestId("rows").textContent).toBe("rows 4 one,rows 4 two,rows 4 three");
  await m.user.click(m.getByTestId("l-next"));
  await expect.poll(() => current(root)).toBe("5");
  await m.user.click(m.getByTestId("l-4"));
  await expect.poll(() => current(root)).toBe("4");
  releaseAll();
  await answered();
  expect(m.getByTestId("rows").textContent).toBe("rows 4 one,rows 4 two,rows 4 three");
  expect(current(root)).toBe("4");
});
