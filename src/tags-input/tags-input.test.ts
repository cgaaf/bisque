// The text handling TagsInput leaves to TypeScript (src/internal/impl/tags-input.ts): splitting typed and pasted
// text, and which entries are accepted.
import { describe, expect, test } from "vitest";
import {
  leftoverText,
  planEntries,
  splitPasted,
  splitTyped,
  withoutIndex,
} from "../internal/impl/tags-input.ts";

const rules = { allowDuplicates: false, max: undefined, validate: undefined };
const short = (value: string) => value.length < 4;

describe("splitTyped", () => {
  test("finishes every part followed by the delimiter and keeps the rest", () => {
    expect(splitTyped("a, b ,c", ",")).toEqual({ entries: ["a", "b"], rest: "c" });
    expect(splitTyped("a,", ",")).toEqual({ entries: ["a"], rest: "" });
    expect(splitTyped(" , ,x", ",")).toEqual({ entries: [], rest: "x" });
  });
  test("with no delimiter in the text, or none at all, nothing is finished", () => {
    expect(splitTyped("abc", ",")).toEqual({ entries: [], rest: "abc" });
    expect(splitTyped("a,b", null)).toEqual({ entries: [], rest: "a,b" });
  });
  test("a delimiter longer than one character", () => {
    expect(splitTyped("a | b | c", " | ")).toEqual({ entries: ["a", "b"], rest: "c" });
  });
});

describe("splitPasted", () => {
  test("splits at the delimiter and at line breaks, every part included", () => {
    expect(splitPasted("a; b\nc\r\nd;", ";")).toEqual(["a", "b", "c", "d"]);
    expect(splitPasted("a,b\nc", null)).toEqual(["a,b", "c"]);
  });
});

describe("planEntries", () => {
  test("adds in order, trimmed, skipping blanks", () => {
    expect(planEntries([" a ", "", "b"], ["x"], rules)).toEqual({ next: ["x", "a", "b"], refused: [] });
  });
  test("refuses a duplicate, also of an entry added in the same batch", () => {
    expect(planEntries(["x", "a", "a"], ["x"], rules)).toEqual({
      next: ["x", "a"],
      refused: [
        { value: "x", reason: "duplicate" },
        { value: "a", reason: "duplicate" },
      ],
    });
    expect(planEntries(["x"], ["x"], { ...rules, allowDuplicates: true }).next).toEqual(["x", "x"]);
  });
  test("refuses past max, then what validate rejects", () => {
    expect(planEntries(["long", "ok", "no"], ["x"], { ...rules, max: 2, validate: short })).toEqual({
      next: ["x", "ok"],
      refused: [
        { value: "long", reason: "invalid" },
        { value: "no", reason: "max" },
      ],
    });
  });
});

describe("leftoverText", () => {
  test("the refused entries, then what is still typed", () => {
    expect(leftoverText([], "abc", ",")).toBe("abc");
    expect(leftoverText([{ value: "a", reason: "duplicate" }], "", ",")).toBe("a");
    expect(
      leftoverText(
        [
          { value: "a", reason: "duplicate" },
          { value: "b", reason: "max" },
        ],
        "c",
        ",",
      ),
    ).toBe("a,b,c");
    expect(leftoverText([{ value: "a", reason: "duplicate" }], "c", null)).toBe("a c");
  });
});

test("withoutIndex removes one entry, not every equal one", () => {
  expect(withoutIndex(["x", "y", "x"], 2)).toEqual(["x", "y"]);
});
