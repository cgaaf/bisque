// The OTP field's value rules (src/internal/impl/otp-field.ts), ported from Base UI's `otp-field/utils/otp.test.ts`,
// and what renders before any browser behaviour is involved.
import { expect, test } from "vitest";
import {
  normalizeOtpValue,
  normalizeOtpValueWithDetails,
  otpCharAt,
  otpInputMode,
  otpLength,
  otpRootPattern,
  otpSlotPattern,
  removeOtpCharacter,
  replaceOtpValue,
} from "../internal/impl/otp-field.ts";

test("strips whitespace, filters by the validation type and clamps to the length", () => {
  expect(normalizeOtpValue(" 12 3\n4 ", 6, "numeric", undefined)).toBe("1234");
  expect(normalizeOtpValue(null, 6, "numeric", undefined)).toBe("");
  expect(normalizeOtpValue(undefined, 6, "numeric", undefined)).toBe("");
  expect(normalizeOtpValue("12a34b5678", 6, "numeric", undefined)).toBe("123456");
  expect(normalizeOtpValue("ab12cd", 6, "alpha", undefined)).toBe("abcd");
  expect(normalizeOtpValue("ab-12_cd!", 6, "alphanumeric", undefined)).toBe("ab12cd");
  expect(normalizeOtpValue("a-1 b", 6, "none", undefined)).toBe("a-1b");
  expect(normalizeOtpValue("123", -1, "numeric", undefined)).toBe("");
});

const upper = (value: string) => value.toUpperCase();

test("applies a custom normalisation after the validation type, filters its output again, then clamps", () => {
  expect(normalizeOtpValue("ab-12", 6, "none", upper)).toBe("AB-12");
  expect(normalizeOtpValue("ab-12 cd!", 6, "alphanumeric", upper)).toBe("AB12CD");
  expect(normalizeOtpValue("12", 6, "numeric", (value) => `${value}x9`)).toBe("129");
  expect(normalizeOtpValue("12", 3, "numeric", (value) => `${value}${value}`)).toBe("121");
});

test("reports the characters it drops", () => {
  expect(normalizeOtpValueWithDetails("12 34", 6, "numeric", undefined)).toEqual({
    value: "1234",
    rejected: false,
  });
  expect(normalizeOtpValueWithDetails("12a", 6, "numeric", undefined)).toEqual({
    value: "12",
    rejected: true,
  });
  expect(normalizeOtpValueWithDetails("1234567", 6, "numeric", undefined)).toEqual({
    value: "123456",
    rejected: true,
  });
  expect(normalizeOtpValueWithDetails("abc", 6, "none", (value) => value.slice(1))).toEqual({
    value: "bc",
    rejected: true,
  });
  expect(normalizeOtpValueWithDetails("1a", 6, "numeric", (value) => `${value}${value}`)).toEqual({
    value: "11",
    rejected: true,
  });
});

test("replaces from a slot on, keeping the rest", () => {
  expect(replaceOtpValue("123456", 2, "99", 6, "numeric", undefined)).toBe("129956");
  expect(replaceOtpValue("123456", 0, "9", 6, "numeric", undefined)).toBe("923456");
  expect(replaceOtpValue("123456", 5, "9", 6, "numeric", undefined)).toBe("123459");
  expect(replaceOtpValue("12", 2, "3456789", 6, "numeric", undefined)).toBe("123456");
  expect(replaceOtpValue("ab", 1, "c", 4, "alpha", (value) => value.toUpperCase())).toBe("AC");
  // A normalisation that drops part of the inserted text keeps the characters after it.
  expect(replaceOtpValue("123456", 2, "9x", 6, "numeric", undefined)).toBe("129456");
});

test("removes one character, closing the gap; out of range changes nothing", () => {
  expect(removeOtpCharacter("1234", 0)).toBe("234");
  expect(removeOtpCharacter("1234", 3)).toBe("123");
  expect(removeOtpCharacter("1234", 4)).toBe("1234");
  expect(removeOtpCharacter("1234", -1)).toBe("1234");
});

test("counts characters by code point", () => {
  expect(otpLength("a😀b")).toBe(3);
  expect(otpCharAt("a😀b", 1)).toBe("😀");
  expect(otpCharAt("ab", 5)).toBe("");
  expect(otpCharAt("ab", -1)).toBe("");
  expect(normalizeOtpValue("😀😀😀", 2, "none", undefined)).toBe("😀😀");
});

test("patterns and keyboards per validation type", () => {
  expect(otpSlotPattern("numeric")).toBe("\\d{1}");
  expect(otpRootPattern("numeric", 6)).toBe("\\d{6}");
  expect(otpRootPattern("alphanumeric", 4)).toBe("[a-zA-Z0-9]{4}");
  expect(otpSlotPattern("none")).toBeUndefined();
  expect(otpRootPattern("none", 4)).toBeUndefined();
  expect(otpInputMode("numeric")).toBe("numeric");
  expect(otpInputMode("alpha")).toBe("text");
  expect(otpInputMode("none")).toBeUndefined();
});
