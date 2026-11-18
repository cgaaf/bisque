// The pure part of Date Field (../internal/impl/segmented-field.ts, date side): the keyed segment list, the form
// string to and from segments, pasted text, range checks, and how long an edit in progress lasts.
import { createRoot, createSignal, flush } from "solid-js";
import { expect, test } from "vitest";
import {
  boundText,
  createDraft,
  isTextOutOfRange,
  segmentList,
  segmentsOfText,
  shownDigits,
  textOfPaste,
  textOfSegments,
  type SegmentDraft,
} from "../internal/impl/segmented-field.ts";

const day = (text: string) => Temporal.PlainDate.from(text);
const us = () => ({ type: "date", locale: "en-US", placeholderValue: day("2026-11-17") }) as const;
const gb = () => ({ type: "date", locale: "en-GB", placeholderValue: day("2026-11-17") }) as const;

test("each segment has a key that its value doesn't change, literals by position", () => {
  const keys = segmentList({}, us()).map((segment) => segment.key);
  expect(keys).toEqual(["month", "literal-1", "day", "literal-3", "year"]);
  expect(segmentList({ year: 2026, month: 11, day: 17 }, us()).map((segment) => segment.key)).toEqual(keys);
  expect(segmentList({}, gb()).map((segment) => segment.key)).toEqual([
    "day",
    "literal-1",
    "month",
    "literal-3",
    "year",
  ]);
});

test("the form string makes segments and back; incomplete or impossible dates make none", () => {
  expect(segmentsOfText("2026-11-17", us())).toEqual({ year: 2026, month: 11, day: 17 });
  expect(segmentsOfText("", us())).toEqual({});
  expect(segmentsOfText("garbage", us())).toEqual({});
  expect(textOfSegments({ year: 2026, month: 11, day: 17 }, us())).toBe("2026-11-17");
  expect(textOfSegments({ year: 2026, month: 11 }, us())).toBe("");
  expect(textOfSegments({ year: 2025, month: 2, day: 29 }, us())).toBe("");
  expect(textOfSegments({ year: 2024, month: 2, day: 29 }, us())).toBe("2024-02-29");
  expect(textOfSegments({ year: 2, month: 1, day: 5 }, us())).toBe("0002-01-05");
});

test("a paste names a whole date or nothing", () => {
  expect(textOfPaste(" 2026-12-24\n", us())).toBe("2026-12-24");
  expect(textOfPaste("2026-02-30", us())).toBeUndefined();
  expect(textOfPaste("12/24/2026", us())).toBeUndefined();
  expect(textOfPaste(null, us())).toBeUndefined();
});

test("out of range is judged by date, never for an empty value", () => {
  const min = "2026-01-01";
  const max = "2026-12-31";
  expect(isTextOutOfRange("2025-12-31", min, max, us())).toBe(true);
  expect(isTextOutOfRange("2027-01-01", min, max, us())).toBe(true);
  expect(isTextOutOfRange("2026-06-15", min, max, us())).toBe(false);
  expect(isTextOutOfRange("", min, max, us())).toBe(false);
  expect(isTextOutOfRange("1999-01-01", undefined, undefined, us())).toBe(false);
  expect(boundText(day(min), us())).toBe("2026-01-01");
  expect(boundText(undefined, us())).toBeUndefined();
});

test("the digits left after Backspace start what is typed next", () => {
  expect(shownDigits({ year: 202 }, "year", us())).toBe("202");
  expect(shownDigits({}, "year", us())).toBe("");
});

const edit = (key: string, base: string): SegmentDraft => ({ key, base, values: { month: 11 } });

test("an edit lasts while the value is its own or the one it started from, and not after a return", () => {
  const { setValue, draft, setDraft, dispose } = createRoot((end) => {
    const [value, write] = createSignal("2026-11-17");
    const [current, change] = createDraft(value);
    // Read, so the derived signal follows the value.
    current();
    return { setValue: write, draft: current, setDraft: change, dispose: end };
  });
  {
    setDraft(edit("", "2026-11-17"));
    flush();
    // The owner keeps its value (a partial edit, or a save still out): the edit stays.
    expect(draft()?.key).toBe("");
    // The owner takes the edit's value.
    setValue("");
    flush();
    expect(draft()?.key).toBe("");
    // Set from outside: the edit is over.
    setValue("2030-01-05");
    flush();
    expect(draft()).toBeUndefined();
    // An optimistic save that failed: the edit's value was shown, then the old one came back.
    setDraft(edit("2030-01-06", "2030-01-05"));
    flush();
    setValue("2030-01-06");
    flush();
    expect(draft()?.key).toBe("2030-01-06");
    setValue("2030-01-05");
    flush();
    expect(draft()).toBeUndefined();
  }
  dispose();
});
