// TagsInput in Chromium, Firefox and WebKit: typing, the keys between the input and the tags, the pointer, the
// rules an entry must pass, the form, and what the live region says.
import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import options from "./fixtures/options.rx";

type Mounted = ReturnType<typeof mount>;

// The tags of the root with `testId`, as their texts.
function tagsOf(mounted: Mounted, testId: string): string[] {
  return [...mounted.getByTestId(testId).querySelectorAll("[data-testid=tag]")].map(
    (tag) => tag.querySelector("span")?.textContent ?? "",
  );
}

// The highlighted tag's text, or null.
function highlightedOf(mounted: Mounted, testId: string): string | null {
  return (
    mounted.getByTestId(testId).querySelector("[data-testid=tag][data-highlighted] span")?.textContent ?? null
  );
}

function statusOf(mounted: Mounted, testId: string): string {
  return (mounted.getByTestId(testId).querySelector("[role=status]")?.textContent ?? "").trim();
}

function setupBasic() {
  const mounted = mount(basic);
  const input = mounted.getByRole<HTMLInputElement>("textbox", { name: "Topics" });
  const tags = () => tagsOf(mounted, "root");
  const highlighted = () => highlightedOf(mounted, "root");
  const status = () => statusOf(mounted, "root");
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, input, tags, highlighted, status, text };
}

test("shows the default tags, each with a remove button named after it, and an empty live region", () => {
  const { tags, getByRole, status, highlighted } = setupBasic();
  expect(tags()).toEqual(["alpha", "beta"]);
  expect(getByRole("button", { name: "Remove alpha" })).toBeTruthy();
  expect(getByRole("button", { name: "Remove beta" }).tabIndex).toBe(-1);
  expect(highlighted()).toBe(null);
  expect(status()).toBe("");
});

test("Enter adds what was typed, trimmed, and empties the input", async () => {
  const { input, tags, text, user } = setupBasic();
  await user.click(input);
  await user.keyboard("  gamma {Enter}");
  expect(tags()).toEqual(["alpha", "beta", "gamma"]);
  expect(input.value).toBe("");
  expect(text("changes")).toBe("alpha|beta|gamma");
  expect(text("typed")).toBe("");
  expect(document.activeElement).toBe(input);
});

test("four tags added in a row", async () => {
  const { input, tags, user } = setupBasic();
  await user.click(input);
  await user.keyboard("c{Enter}d{Enter}e{Enter}f{Enter}");
  expect(tags()).toEqual(["alpha", "beta", "c", "d", "e", "f"]);
  expect(input.value).toBe("");
});

test("typing the delimiter finishes an entry; what follows it stays", async () => {
  const { input, tags, user } = setupBasic();
  await user.click(input);
  await user.keyboard("gamma,del");
  expect(tags()).toEqual(["alpha", "beta", "gamma"]);
  expect(input.value).toBe("del");
  // A lone delimiter or blank text adds nothing.
  await user.clear(input);
  await user.keyboard(" ,");
  expect(tags()).toEqual(["alpha", "beta", "gamma"]);
  expect(input.value).toBe("");
});

test("Enter in an empty input is left to the form; Enter that adds a tag is not", async () => {
  const { input, getByTestId, user } = setupBasic();
  let submits = 0;
  getByTestId("form").addEventListener("submit", () => (submits += 1));
  await user.click(input);
  await user.keyboard("gamma{Enter}");
  expect(submits).toBe(0);
  await user.keyboard("{Enter}");
  expect(submits).toBe(1);
});

test("a duplicate is refused: it stays in the input and onValueInvalid says why", async () => {
  const { input, tags, text, user } = setupBasic();
  await user.click(input);
  await user.keyboard("alpha{Enter}");
  expect(tags()).toEqual(["alpha", "beta"]);
  expect(input.value).toBe("alpha");
  expect(text("refused")).toBe("duplicate:alpha");
  // Typed with the delimiter, the same.
  await user.clear(input);
  await user.keyboard("beta,");
  expect(tags()).toEqual(["alpha", "beta"]);
  expect(input.value).toBe("beta");
  expect(text("refused")).toBe("duplicate:beta");
});

test("Backspace in the empty input highlights the last tag, then removes it and highlights the one before", async () => {
  const { input, tags, highlighted, status, text, user } = setupBasic();
  await user.click(input);
  await user.keyboard("{Backspace}");
  expect(highlighted()).toBe("beta");
  expect(tags()).toEqual(["alpha", "beta"]);
  expect(status()).toBe("beta, press Backspace or Delete to remove");
  await user.keyboard("{Backspace}");
  expect(tags()).toEqual(["alpha"]);
  expect(highlighted()).toBe("alpha");
  expect(status()).toBe("beta removed. alpha, press Backspace or Delete to remove");
  expect(text("changes")).toBe("alpha");
  await user.keyboard("{Backspace}");
  expect(tags()).toEqual([]);
  expect(highlighted()).toBe(null);
  expect(status()).toBe("alpha removed");
  expect(document.activeElement).toBe(input);
});

test("Delete removes the highlighted tag and highlights the one after; past the last, the text", async () => {
  const { input, tags, highlighted, user } = setupBasic();
  await user.click(input);
  await user.keyboard("{ArrowLeft}{ArrowLeft}");
  expect(highlighted()).toBe("alpha");
  await user.keyboard("{Delete}");
  expect(tags()).toEqual(["beta"]);
  expect(highlighted()).toBe("beta");
  await user.keyboard("{Delete}");
  expect(tags()).toEqual([]);
  expect(highlighted()).toBe(null);
});

test("the arrow keys, Home, End and Escape move between the tags and the text", async () => {
  const { input, highlighted, user } = setupBasic();
  await user.click(input);
  await user.keyboard("{ArrowLeft}");
  expect(highlighted()).toBe("beta");
  await user.keyboard("{ArrowLeft}");
  expect(highlighted()).toBe("alpha");
  // At the first tag, ArrowLeft stays.
  await user.keyboard("{ArrowLeft}");
  expect(highlighted()).toBe("alpha");
  await user.keyboard("{ArrowRight}");
  expect(highlighted()).toBe("beta");
  await user.keyboard("{ArrowRight}");
  expect(highlighted()).toBe(null);
  await user.keyboard("{ArrowLeft}{Home}");
  expect(highlighted()).toBe("alpha");
  await user.keyboard("{End}");
  expect(highlighted()).toBe(null);
  await user.keyboard("{ArrowLeft}{Escape}");
  expect(highlighted()).toBe(null);
  expect(document.activeElement).toBe(input);
});

test("with text, the arrow keys move the caret until it is at the start; typing clears a highlight", async () => {
  const { input, highlighted, user } = setupBasic();
  await user.click(input);
  await user.keyboard("ab{ArrowLeft}");
  expect(highlighted()).toBe(null);
  expect(input.selectionStart).toBe(1);
  await user.keyboard("{ArrowLeft}");
  expect(input.selectionStart).toBe(0);
  expect(highlighted()).toBe(null);
  await user.keyboard("{ArrowLeft}");
  expect(highlighted()).toBe("beta");
  expect(input.value).toBe("ab");
  await user.keyboard("c");
  expect(highlighted()).toBe(null);
  expect(input.value).toBe("cab");
});

test("the remove button removes its tag and leaves focus in the input", async () => {
  const { input, tags, getByRole, status, text, user } = setupBasic();
  await user.click(input);
  await user.click(getByRole("button", { name: "Remove alpha" }));
  expect(tags()).toEqual(["beta"]);
  expect(text("changes")).toBe("beta");
  expect(status()).toBe("alpha removed");
  expect(document.activeElement).toBe(input);
});

test("a press on the control focuses the input; a press on a tag highlights it", async () => {
  const { input, getByTestId, getAllByTestId, highlighted, user } = setupBasic();
  await user.click(getByTestId("control"), { position: { x: 316, y: 10 } });
  expect(document.activeElement).toBe(input);
  input.blur();
  await user.click(getAllByTestId("tag")[0].querySelector("span")!);
  expect(highlighted()).toBe("alpha");
  expect(document.activeElement).toBe(input);
  // Leaving the input drops the highlight.
  input.blur();
  await frame();
  expect(highlighted()).toBe(null);
});

test("Clear removes every tag and the text, and is shown only while there is something to clear", async () => {
  const { input, tags, getByRole, queryByRole, status, user } = setupBasic();
  await user.click(input);
  await user.keyboard("x");
  await user.click(getByRole("button", { name: "Clear" }));
  expect(tags()).toEqual([]);
  expect(input.value).toBe("");
  expect(status()).toBe("All tags removed");
  expect(document.activeElement).toBe(input);
  expect(queryByRole("button", { name: "Clear" })).toBe(null);
});

test("each tag is submitted under the name, and a form reset puts the default tags back", async () => {
  const { input, tags, getByTestId, getByRole, text, user } = setupBasic();
  const form = getByTestId("form") as HTMLFormElement;
  expect(new FormData(form).getAll("topics")).toEqual(["alpha", "beta"]);
  await user.click(input);
  await user.keyboard("gamma{Enter}{Backspace}{Backspace}{Backspace}");
  expect(tags()).toEqual(["alpha"]);
  await user.keyboard("draft");
  expect(new FormData(form).getAll("topics")).toEqual(["alpha"]);
  await user.click(getByRole("button", { name: "Reset" }));
  await expect.poll(() => tags()).toEqual(["alpha", "beta"]);
  expect(input.value).toBe("");
  expect(text("changes")).toBe("alpha|beta");
  expect(new FormData(form).getAll("topics")).toEqual(["alpha", "beta"]);
});

test("nothing is added while an IME composition is in progress", async () => {
  const { input, tags, user } = setupBasic();
  await user.click(input);
  input.value = "かな";
  input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true, data: "かな" }));
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, isComposing: true }),
  );
  await frame();
  expect(tags()).toEqual(["alpha", "beta"]);
  expect(input.value).toBe("かな");
  // A delimiter typed during the composition waits for it to end.
  input.value = "かな,";
  input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true, data: "," }));
  await frame();
  expect(tags()).toEqual(["alpha", "beta"]);
  input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "かな," }));
  await frame();
  expect(tags()).toEqual(["alpha", "beta", "かな"]);
  expect(input.value).toBe("");
  // Enter once the composition is over adds.
  await user.keyboard("x{Enter}");
  expect(tags()).toEqual(["alpha", "beta", "かな", "x"]);
});

// The options fixture.

test("max and validate refuse an entry, with the reason", async () => {
  const mounted = mount(options);
  const { user, getByRole, getByTestId } = mounted;
  const input = getByRole<HTMLInputElement>("textbox", { name: "Limited" });
  await user.click(input);
  await user.keyboard("toolongtext{Enter}");
  expect(tagsOf(mounted, "limited")).toEqual(["one"]);
  expect(input.value).toBe("toolongtext");
  expect(getByTestId("refused").textContent).toBe("invalid:toolongtext");
  await user.clear(input);
  await user.keyboard("two{Enter}three{Enter}four{Enter}");
  expect(tagsOf(mounted, "limited")).toEqual(["one", "two", "three"]);
  expect(input.value).toBe("four");
  expect(getByTestId("refused").textContent).toBe("max:four");
});

test("allowDuplicates keeps the same text twice, and removes the one pressed", async () => {
  const mounted = mount(options);
  const { user, getByRole } = mounted;
  const input = getByRole<HTMLInputElement>("textbox", { name: "Duplicates" });
  await user.click(input);
  await user.keyboard("y{Enter}");
  expect(tagsOf(mounted, "duplicates")).toEqual(["x", "y", "x", "y"]);
  // The second "x": Backspace from the text highlights the last tag, ArrowLeft moves to the "x" before it.
  await user.keyboard("{Backspace}{ArrowLeft}");
  // This root passes its own messages.
  expect(statusOf(mounted, "duplicates")).toBe("on x");
  await user.keyboard("{Delete}");
  expect(tagsOf(mounted, "duplicates")).toEqual(["x", "y", "y"]);
  expect(highlightedOf(mounted, "duplicates")).toBe("y");
  expect(statusOf(mounted, "duplicates")).toBe("gone x. on y");
});

test("addOnBlur adds what was typed when the input loses focus", async () => {
  const mounted = mount(options);
  const { user, getByRole } = mounted;
  const input = getByRole<HTMLInputElement>("textbox", { name: "Blur" });
  await user.click(input);
  await user.keyboard("later");
  await user.click(getByRole("textbox", { name: "Typed paste" }));
  expect(tagsOf(mounted, "blur")).toEqual(["later"]);
  expect(input.value).toBe("");
});

// A paste from the real clipboard: the text is copied from a textarea first.
async function paste(mounted: Mounted, label: string, text: string) {
  const source = mounted.getByRole<HTMLTextAreaElement>("textbox", { name: "Source" });
  source.value = text;
  source.focus();
  source.select();
  await mounted.user.copy();
  const input = mounted.getByRole<HTMLInputElement>("textbox", { name: label });
  await mounted.user.click(input);
  await mounted.user.paste();
  return input;
}

test("addOnPaste adds every pasted entry, split at the delimiter and at line breaks", async () => {
  const mounted = mount(options);
  const input = await paste(mounted, "Paste", "one; two\nthree");
  await expect.poll(() => tagsOf(mounted, "paste")).toEqual(["one", "two", "three"]);
  expect(input.value).toBe("");
});

test("without addOnPaste, a paste is typed text: entries before a delimiter are added, the rest stays", async () => {
  const mounted = mount(options);
  const input = await paste(mounted, "Typed paste", "one,two,thr");
  await expect.poll(() => tagsOf(mounted, "typed-paste")).toEqual(["one", "two"]);
  expect(input.value).toBe("thr");
});

test("with no delimiter, a comma is text", async () => {
  const mounted = mount(options);
  const input = mounted.getByRole<HTMLInputElement>("textbox", { name: "No delimiter" });
  await mounted.user.click(input);
  await mounted.user.keyboard("a,b{Enter}");
  expect(tagsOf(mounted, "no-delimiter")).toEqual(["a,b"]);
});

test("disabled: the input and the remove buttons are disabled, and a press on a tag highlights nothing", async () => {
  const mounted = mount(options);
  const root = mounted.getByTestId("disabled");
  const input = mounted.getByRole<HTMLInputElement>("textbox", { name: "Disabled" });
  expect(input.disabled).toBe(true);
  expect(root.querySelector<HTMLButtonElement>("button[aria-label='Remove a']")!.disabled).toBe(true);
  expect(root.hasAttribute("data-disabled")).toBe(true);
  const tag = root.querySelector<HTMLElement>("[data-testid=tag]")!;
  expect(tag.hasAttribute("data-disabled")).toBe(true);
  await mounted.user.click(tag.querySelector("span")!);
  expect(tag.hasAttribute("data-highlighted")).toBe(false);
});

test("required without a field: the form is invalid until there is a tag", async () => {
  const mounted = mount(options);
  const form = mounted.getByTestId("native-form") as HTMLFormElement;
  const input = mounted.getByRole<HTMLInputElement>("textbox", { name: "Native required" });
  expect(form.checkValidity()).toBe(false);
  expect(input.validity.valueMissing).toBe(true);
  await mounted.user.click(input);
  await mounted.user.keyboard("one{Enter}");
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).getAll("needed")).toEqual(["one"]);
  await mounted.user.keyboard("{Backspace}{Backspace}");
  expect(form.checkValidity()).toBe(false);
});

test("read-only: tags can be highlighted but not removed or added", async () => {
  const mounted = mount(options);
  const { user, getByRole } = mounted;
  const input = getByRole<HTMLInputElement>("textbox", { name: "Read-only" });
  expect(input.readOnly).toBe(true);
  const removeA = mounted
    .getByTestId("readonly")
    .querySelector<HTMLButtonElement>("button[aria-label='Remove a']")!;
  expect(removeA.disabled).toBe(true);
  await user.click(input);
  await user.keyboard("{Backspace}");
  expect(highlightedOf(mounted, "readonly")).toBe("b");
  expect(statusOf(mounted, "readonly")).toBe("b");
  await user.keyboard("{Backspace}{Delete}");
  expect(tagsOf(mounted, "readonly")).toEqual(["a", "b"]);
  await user.keyboard("{Escape}x{Enter}");
  expect(tagsOf(mounted, "readonly")).toEqual(["a", "b"]);
  expect(input.value).toBe("");
});

test("controlled: the owner's value and text are shown, whatever it makes of a change", async () => {
  const mounted = mount(options);
  const { user, getByRole, getByTestId } = mounted;
  const input = getByRole<HTMLInputElement>("textbox", { name: "Controlled" });
  await user.click(input);
  await user.keyboard("ab");
  await expect.poll(() => input.value).toBe("AB");
  expect(getByTestId("controlled-text").textContent).toBe("AB");
  await user.keyboard("{Enter}");
  await expect.poll(() => tagsOf(mounted, "controlled")).toEqual(["red", "ab"]);
  expect(input.value).toBe("");
  await user.keyboard("{Backspace}{Backspace}");
  expect(tagsOf(mounted, "controlled")).toEqual(["red"]);
  expect(getByTestId("controlled-value").textContent).toBe("red");
  await user.click(getByRole("button", { name: "Set blue" }));
  expect(tagsOf(mounted, "controlled")).toEqual(["blue"]);
});
