import { describe, expect, test } from "vitest";
import { paginate, type PaginationEntry } from "../internal/impl/pagination.ts";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

// The entries as a string: "1 … 4 5 6 … 20".
const show = (items: PaginationEntry[]) => items.map((i) => (i.type === "page" ? i.value : "…")).join(" ");

describe("paginate", () => {
  test("no pages and one page", () => {
    expect(paginate({ count: 0, page: 1 })).toEqual({ page: 1, pageCount: 0, items: [] });
    expect(paginate({ pageCount: 0, page: 3 }).items).toEqual([]);
    expect(paginate({ count: 7, page: 1 })).toEqual({
      page: 1,
      pageCount: 1,
      items: [{ type: "page", value: 1, key: "page-1" }],
    });
  });

  test("pageCount comes from count and pageSize (default 10), or is given", () => {
    expect(paginate({ count: 95, page: 1 }).pageCount).toBe(10);
    expect(paginate({ count: 101, page: 1 }).pageCount).toBe(11);
    expect(paginate({ count: 101, pageSize: 25, page: 1 }).pageCount).toBe(5);
    expect(paginate({ count: 500, pageCount: 3, page: 1 }).pageCount).toBe(3);
  });

  test("the page is clamped to the pages there are", () => {
    expect(paginate({ pageCount: 5, page: 9 }).page).toBe(5);
    expect(paginate({ pageCount: 5, page: 0 }).page).toBe(1);
    expect(paginate({ pageCount: 5, page: -3 }).page).toBe(1);
    expect(paginate({ pageCount: 5, page: Number.NaN }).page).toBe(1);
    expect(paginate({ pageCount: 5, page: 2.7 }).page).toBe(2);
  });

  test("lists every page while they fit", () => {
    expect(show(paginate({ pageCount: 7, page: 4 }).items)).toBe("1 2 3 4 5 6 7");
    expect(show(paginate({ pageCount: 3, page: 1 }).items)).toBe("1 2 3");
  });

  test("first, last and the middle", () => {
    expect(show(paginate({ pageCount: 20, page: 1 }).items)).toBe("1 2 3 4 5 … 20");
    expect(show(paginate({ pageCount: 20, page: 20 }).items)).toBe("1 … 16 17 18 19 20");
    expect(show(paginate({ pageCount: 20, page: 10 }).items)).toBe("1 … 9 10 11 … 20");
  });

  test("a window that touches a boundary shows the page an ellipsis would hide", () => {
    expect(show(paginate({ pageCount: 20, page: 4 }).items)).toBe("1 2 3 4 5 … 20");
    expect(show(paginate({ pageCount: 20, page: 5 }).items)).toBe("1 … 4 5 6 … 20");
    expect(show(paginate({ pageCount: 20, page: 17 }).items)).toBe("1 … 16 17 18 19 20");
    expect(show(paginate({ pageCount: 20, page: 16 }).items)).toBe("1 … 15 16 17 … 20");
    expect(show(paginate({ pageCount: 8, page: 4 }).items)).toBe("1 2 3 4 5 … 8");
  });

  test("siblingCount and boundaryCount", () => {
    expect(show(paginate({ pageCount: 30, page: 15, siblingCount: 2, boundaryCount: 2 }).items)).toBe(
      "1 2 … 13 14 15 16 17 … 29 30",
    );
    expect(show(paginate({ pageCount: 30, page: 15, siblingCount: 0 }).items)).toBe("1 … 15 … 30");
    expect(show(paginate({ pageCount: 30, page: 15, boundaryCount: 0 }).items)).toBe("… 14 15 16 …");
    expect(show(paginate({ pageCount: 30, page: 1, boundaryCount: 0 }).items)).toBe("1 2 3 4 …");
  });

  test("large counts", () => {
    const { pageCount, items } = paginate({ count: 1_000_000, pageSize: 20, page: 31_337 });
    expect(pageCount).toBe(50_000);
    expect(show(items)).toBe("1 … 31336 31337 31338 … 50000");
  });

  test("keys name an entry across pages and are unique", () => {
    const { items } = paginate({ pageCount: 20, page: 10 });
    expect(items.map((i) => i.key)).toEqual([
      "page-1",
      "ellipsis-start",
      "page-9",
      "page-10",
      "page-11",
      "ellipsis-end",
      "page-20",
    ]);
  });

  test("keeps a constant length as the page changes, and an ellipsis never hides one page", () => {
    const problems: string[] = [];
    for (const siblingCount of [0, 1, 2, 3]) {
      for (const boundaryCount of [0, 1, 2]) {
        for (let pageCount = 0; pageCount <= 30; pageCount++) {
          const expected = Math.min(pageCount, 2 * boundaryCount + 2 * siblingCount + 3);
          for (let page = 1; page <= Math.max(pageCount, 1); page++) {
            const { items } = paginate({ pageCount, page, siblingCount, boundaryCount });
            const where = `pageCount ${pageCount}, page ${page}, siblings ${siblingCount}, boundary ${boundaryCount}`;
            problems.push(...entryProblems(items, page, pageCount, expected).map((p) => `${where}: ${p}`));
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

// What is wrong with a list of entries, if anything.
function entryProblems(items: PaginationEntry[], page: number, pageCount: number, length: number): string[] {
  const problems: string[] = [];
  if (items.length !== length) problems.push(`length ${items.length}, not ${length}`);
  const keys = new Set(items.map((i) => i.key));
  if (keys.size !== items.length) problems.push("repeated keys");
  if (pageCount > 0 && !keys.has(`page-${page}`)) problems.push("the current page is missing");
  // Pages are in order; an ellipsis stands for at least two.
  const valueAt = (i: number, outside: number) => {
    const item = items[i];
    return item?.type === "page" ? item.value : outside;
  };
  items.forEach((item, i) => {
    if (item.type === "page") {
      if (item.value <= valueAt(i - 1, 0)) problems.push("out of order");
    } else if (valueAt(i + 1, pageCount + 1) - valueAt(i - 1, 0) - 1 < 2) {
      problems.push(`${item.key} hides fewer than two pages`);
    }
  });
  return problems;
}

const current = (root: HTMLElement) =>
  [...root.querySelectorAll("[aria-current]")].map((el) => [el.textContent, el.getAttribute("aria-current")]);

describe("PaginationRoot", () => {
  test("a labelled nav whose items render from defaultPage", () => {
    const { getByTestId } = mount(basic);
    const root = getByTestId("uncontrolled");
    expect(root.tagName).toBe("NAV");
    expect(root.getAttribute("aria-label")).toBe("Pagination");
    expect(root.className).toBe("mine");
    expect(getByTestId("controlled").getAttribute("aria-label")).toBe("Results");
    expect(current(root)).toEqual([["5", "page"]]);
    expect(getByTestId("u-5").hasAttribute("data-current")).toBe(true);
    expect(getByTestId("u-4").hasAttribute("data-current")).toBe(false);
    expect(getByTestId("u-4").getAttribute("aria-label")).toBe("Page 4");
    expect(getByTestId("u-4").getAttribute("type")).toBe("button");
    expect(getByTestId("u-ellipsis-start").getAttribute("aria-hidden")).toBe("true");
    expect(root.querySelectorAll("li")).toHaveLength(7);
  });

  test("an item, Previous and Next change the page and tell onPageChange", async () => {
    const { getByTestId, user } = mount(basic);
    const root = getByTestId("uncontrolled");
    await user.click(getByTestId("u-6"));
    expect(current(root)).toEqual([["6", "page"]]);
    expect(getByTestId("log").textContent).toBe("6");
    await user.click(getByTestId("u-next"));
    expect(current(root)).toEqual([["7", "page"]]);
    await user.click(getByTestId("u-prev"));
    await user.click(getByTestId("u-prev"));
    expect(current(root)).toEqual([["5", "page"]]);
    expect(getByTestId("log").textContent).toBe("5");
    // Pressing the current page changes nothing and reports nothing.
    await user.click(getByTestId("u-5"));
    expect(getByTestId("log").textContent).toBe("5");
    await user.click(getByTestId("u-1"));
    expect(root.querySelectorAll("li")).toHaveLength(7);
    expect((getByTestId("u-prev") as HTMLButtonElement).disabled).toBe(true);
    await user.click(getByTestId("u-20"));
    expect((getByTestId("u-next") as HTMLButtonElement).disabled).toBe(true);
    expect((getByTestId("u-prev") as HTMLButtonElement).disabled).toBe(false);
  });

  test("controlled: the page follows the owner", async () => {
    const { getByTestId, user } = mount(basic);
    const root = getByTestId("controlled");
    expect(current(root)).toEqual([["4", "page"]]);
    await user.click(getByTestId("c-next"));
    expect(getByTestId("page").textContent).toBe("5");
    expect(current(root)).toEqual([["5", "page"]]);
    await user.click(getByTestId("c-2"));
    expect(getByTestId("page").textContent).toBe("2");
    expect(current(root)).toEqual([["2", "page"]]);
  });

  test("controlled: an owner that refuses the change keeps the page", async () => {
    const { getByTestId, user } = mount(basic);
    const root = getByTestId("refused");
    await user.click(getByTestId("r-3"));
    expect(getByTestId("log").textContent).toBe("refused 3");
    expect(current(root)).toEqual([["2", "page"]]);
    await user.click(getByTestId("r-next"));
    expect(current(root)).toEqual([["2", "page"]]);
    await user.click(getByTestId("r-prev"));
    expect(getByTestId("log").textContent).toBe("refused 1");
    expect(current(root)).toEqual([["2", "page"]]);
  });

  test("one page and no pages: Previous and Next are disabled and drop the consumer's handlers", async () => {
    const { getByTestId } = mount(basic);
    expect(current(getByTestId("single"))).toEqual([["1", "page"]]);
    for (const id of ["s-prev", "s-next", "e-prev", "e-next"]) {
      const step = getByTestId(id) as HTMLButtonElement;
      expect(step.disabled).toBe(true);
      expect(step.hasAttribute("data-disabled")).toBe(true);
    }
    expect(getByTestId("empty").querySelectorAll("li")).toHaveLength(0);
    // A disabled button gets no click from a user; the handler is dropped for the element playing one too.
    getByTestId("s-prev").click();
    expect(getByTestId("log").textContent).toBe("");
  });
});
