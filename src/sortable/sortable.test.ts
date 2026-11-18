// The order maths and the announcement texts, which need no browser.
import { expect, test } from "vitest";
import {
  copyLists,
  moveInLists,
  moveInOrder,
  sameLists,
  sameOrder,
  sortableMessages,
} from "../internal/impl/sortable.ts";

test("moveInOrder moves an id to an index counted without it, clamped to the ends", () => {
  const order = ["a", "b", "c", "d"];
  expect(moveInOrder(order, "a", 2)).toEqual(["b", "c", "a", "d"]);
  expect(moveInOrder(order, "d", 0)).toEqual(["d", "a", "b", "c"]);
  expect(moveInOrder(order, "b", 1)).toEqual(order);
  expect(moveInOrder(order, "b", 99)).toEqual(["a", "c", "d", "b"]);
  expect(moveInOrder(order, "b", -3)).toEqual(["b", "a", "c", "d"]);
  // An id the order doesn't have changes nothing, and the given array is never changed.
  expect(moveInOrder(order, "z", 1)).toEqual(order);
  expect(order).toEqual(["a", "b", "c", "d"]);
});

test("moveInLists takes an id from whichever list holds it and puts it in another", () => {
  const lists = { todo: ["a", "b"], done: ["c"] };
  expect(moveInLists(lists, "a", "done", 1)).toEqual({ todo: ["b"], done: ["c", "a"] });
  expect(moveInLists(lists, "c", "todo", 0)).toEqual({ todo: ["c", "a", "b"], done: [] });
  expect(moveInLists(lists, "b", "todo", 0)).toEqual({ todo: ["b", "a"], done: ["c"] });
  // A list the value doesn't name yet is created.
  expect(moveInLists(lists, "a", "later", 0)).toEqual({ todo: ["b"], done: ["c"], later: ["a"] });
  expect(lists).toEqual({ todo: ["a", "b"], done: ["c"] });
});

test("the comparisons and copies", () => {
  expect(sameOrder(["a", "b"], ["a", "b"])).toBe(true);
  expect(sameOrder(["a", "b"], ["b", "a"])).toBe(false);
  expect(sameOrder(undefined, undefined)).toBe(true);
  expect(sameOrder(["a"], undefined)).toBe(false);
  expect(sameLists({ x: ["a"], y: [] }, { y: [], x: ["a"] })).toBe(true);
  expect(sameLists({ x: ["a"] }, { x: ["a"], y: [] })).toBe(false);
  const lists = { x: ["a"] };
  const copy = copyLists(lists);
  expect(copy).toEqual(lists);
  expect(copy.x).not.toBe(lists.x);
  expect(copyLists(undefined)).toEqual({});
});

test("the default texts name the list only in a group, and given texts replace them one by one", () => {
  const details = {
    id: "a",
    label: "Apples",
    position: 2,
    total: 5,
    list: "todo",
    listLabel: "To do",
    grouped: false,
  };
  const messages = sortableMessages(undefined);
  expect(messages.pickedUp(details)).toBe("Picked up Apples, position 2 of 5.");
  expect(messages.moved({ ...details, grouped: true })).toBe("Apples moved to position 2 of 5 in To do.");
  expect(messages.dropped(details)).toBe("Dropped Apples at position 2 of 5.");
  expect(messages.cancelled(details)).toBe("Cancelled. Apples is back at position 2 of 5.");
  expect(messages.roleDescription).toBe("sortable");
  const french = sortableMessages({
    roleDescription: "triable",
    moved: (d) => `${d.label} : ${d.position} sur ${d.total}`,
  });
  expect(french.roleDescription).toBe("triable");
  expect(french.moved(details)).toBe("Apples : 2 sur 5");
  expect(french.dropped(details)).toBe("Dropped Apples at position 2 of 5.");
});
