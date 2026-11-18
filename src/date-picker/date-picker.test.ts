// The pure part the Date Picker and Date Range Picker share (../internal/impl/date-picker.ts): merging a part's
// props without building the consumer's children, and a range's validity across its two hidden inputs.
import { createRoot, createSignal, flush } from "solid-js";
import { expect, test } from "vitest";
import { createRangeValidity, mergeOuterProps } from "../internal/impl/date-picker.ts";

test("mergeOuterProps merges as mergeProps does and never reads children", () => {
  let reads = 0;
  const external = {
    class: "theirs",
    "aria-label": "Due",
    onClick: () => {},
    get children() {
      reads += 1;
      return "built";
    },
  };
  const merged = mergeOuterProps({ class: "ours", role: "group", "aria-label": "Default" }, external);
  expect(reads).toBe(0);
  expect(merged.children).toBeUndefined();
  expect(merged.class).toEqual(["ours", "theirs"]);
  expect(merged["aria-label"]).toBe("Due");
  expect(merged.role).toBe("group");
  expect(typeof merged.onClick).toBe("function");
  expect(mergeOuterProps({ role: "group" }, undefined)).toEqual({ role: "group" });
});

function input(attributes: Record<string, string>) {
  const element = document.createElement("input");
  element.type = "date";
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

test("createRangeValidity: each side's message, and the end's problem on the start input", () => {
  const start = input({ max: "2030-12-31" });
  const end = input({ max: "2030-12-31" });
  const [startMessage, setStartMessage] = createSignal("");
  const [endMessage, setEndMessage] = createSignal("");
  const [key, setKey] = createSignal("");
  const dispose = createRoot((done) => {
    createRangeValidity(
      () => start,
      () => end,
      startMessage,
      endMessage,
      key,
    );
    return done;
  });
  flush();
  expect(start.validity.valid).toBe(true);
  setEndMessage("Enter a complete date.");
  flush();
  expect(end.validationMessage).toBe("Enter a complete date.");
  expect(start.validationMessage).toBe("Enter a complete date.");
  setStartMessage("The end date is before the start date.");
  flush();
  expect(start.validationMessage).toBe("The end date is before the start date.");
  setStartMessage("");
  setEndMessage("");
  flush();
  expect(start.validity.valid).toBe(true);
  // A native problem of the end (beyond max) reaches the start once the key says the value changed.
  end.value = "2031-01-05";
  setKey("/2031-01-05");
  flush();
  expect(end.validity.rangeOverflow).toBe(true);
  expect(start.validity.customError).toBe(true);
  end.value = "2030-01-05";
  setKey("/2030-01-05");
  flush();
  expect(start.validity.valid).toBe(true);
  dispose();
});
