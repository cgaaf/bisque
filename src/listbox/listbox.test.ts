// The selection maths of an always-visible listbox (src/internal/impl/listbox-selection.ts), on a plain DOM.
import { expect, test } from "vitest";
import {
  enabledValues,
  focusedValue,
  selectionValues,
  valuesBetween,
} from "../internal/impl/listbox-selection.ts";

function list(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <div data-bisque-item data-value="a" tabindex="-1">A</div>
    <div role="group">
      <div data-bisque-item data-value="b" tabindex="-1">B</div>
      <div data-bisque-item data-value="c" data-disabled tabindex="-1">C</div>
    </div>
    <div data-bisque-item data-value="d" tabindex="-1">D</div>
    <div data-bisque-item data-value="e" tabindex="-1">E</div>`;
  document.body.append(root);
  return root;
}

test("a value as a list: a string, a list (copied), or nothing", () => {
  expect(selectionValues("a")).toEqual(["a"]);
  expect(selectionValues(null)).toEqual([]);
  expect(selectionValues(undefined)).toEqual([]);
  const given = ["a", "b"];
  const values = selectionValues(given);
  expect(values).toEqual(given);
  expect(values).not.toBe(given);
});

test("the enabled values, in document order, groups included", () => {
  expect(enabledValues(list())).toEqual(["a", "b", "d", "e"]);
  expect(enabledValues(undefined)).toEqual([]);
});

test("a range runs either way between two values, skipping disabled options", () => {
  const root = list();
  expect(valuesBetween(root, "a", "d")).toEqual(["a", "b", "d"]);
  expect(valuesBetween(root, "e", "b")).toEqual(["b", "d", "e"]);
  expect(valuesBetween(root, "b", "b")).toEqual(["b"]);
  // An anchor that is gone, or disabled: the range is the target alone.
  expect(valuesBetween(root, "gone", "d")).toEqual(["d"]);
  expect(valuesBetween(root, "c", "d")).toEqual(["d"]);
  expect(valuesBetween(root, "a", "c")).toEqual([]);
});

test("the focused value: an enabled option of this list, else nothing", () => {
  const root = list();
  expect(focusedValue(root)).toBeUndefined();
  (root.querySelector("[data-value=d]") as HTMLElement).focus();
  expect(focusedValue(root)).toBe("d");
  (root.querySelector("[data-value=c]") as HTMLElement).focus();
  expect(focusedValue(root)).toBeUndefined();
});
