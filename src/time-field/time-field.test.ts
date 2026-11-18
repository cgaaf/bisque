// The pure part of Time Field (../internal/impl/segmented-field.ts, time side): the form string down to the
// granularity, pasted times and range checks by time.
import { expect, test } from "vitest";
import {
  boundText,
  isTextOutOfRange,
  segmentList,
  segmentsOfText,
  shownDigits,
  textOfPaste,
  textOfSegments,
} from "../internal/impl/segmented-field.ts";

const time = (text: string) => Temporal.PlainTime.from(text);
const us = (granularity?: "hour" | "minute" | "second") =>
  ({ type: "time", locale: "en-US", granularity }) as const;

test("keys: hour, minute and day period in en-US; seconds with that granularity", () => {
  expect(segmentList({}, us()).map((segment) => segment.key)).toEqual([
    "hour",
    "literal-1",
    "minute",
    "literal-3",
    "dayPeriod",
  ]);
  expect(segmentList({}, us("second")).map((segment) => segment.kind)).toContain("second");
});

test("the form string goes down to the granularity", () => {
  const values = segmentsOfText("13:45:30", us("second"));
  expect(values).toEqual({ hour: 13, minute: 45, second: 30, dayPeriod: 1 });
  expect(textOfSegments(values, us("second"))).toBe("13:45:30");
  expect(textOfSegments(values, us("minute"))).toBe("13:45");
  expect(textOfSegments(values, us("hour"))).toBe("13:00");
  // 12-hour time needs its day period.
  expect(textOfSegments({ hour: 1, minute: 45 }, us())).toBe("");
  expect(textOfSegments({ hour: 1, minute: 45 }, { ...us(), hourCycle: 24 })).toBe("01:45");
});

test("pastes and ranges", () => {
  expect(textOfPaste("13:45", us())).toBe("13:45");
  expect(textOfPaste("13:45:30", us("second"))).toBe("13:45:30");
  expect(textOfPaste("1:45 PM", us())).toBeUndefined();
  expect(isTextOutOfRange("05:00", "06:00:00", "22:00:00", us())).toBe(true);
  expect(isTextOutOfRange("06:00", "06:00:00", "22:00:00", us())).toBe(false);
  expect(isTextOutOfRange("22:00:01", "06:00:00", "22:00:00", us("second"))).toBe(true);
  expect(boundText(time("06:00"), us())).toBe("06:00:00");
});

test("the hour's digits after Backspace are as shown on the clock face", () => {
  expect(shownDigits({ hour: 13, dayPeriod: 1 }, "hour", us())).toBe("1");
  expect(shownDigits({ hour: 1, dayPeriod: 1 }, "dayPeriod", us())).toBe("");
});
