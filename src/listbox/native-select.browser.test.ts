// Why Listbox isn't built on the native listbox, `<select multiple>` / `<select size>`: what the three engines do with
// its list form, as of the versions under test. The docs page's "What the browser does" section rests on these. If
// one of them starts failing, an engine has changed and the family's platform question is worth asking again.
import { afterEach, expect, test } from "vitest";
import { server, userEvent } from "vitest/browser";

let host: HTMLElement | undefined;

afterEach(() => {
  host?.remove();
  host = undefined;
});

function nativeList(): HTMLSelectElement {
  host = document.createElement("div");
  host.innerHTML = `
    <style>
      .probe option { padding: 10px; }
      .probe option:checked { background-color: rgb(255, 0, 0); }
    </style>
    <select class="probe" multiple size="4" aria-label="Native">
      <option value="a" selected>A</option>
      <option value="b"><span class="mark">✓</span> B</option>
      <option value="c">C</option>
    </select>`;
  document.body.append(host);
  return host.querySelector("select")!;
}

test("the styleable form (`appearance: base-select`) is missing in Firefox", () => {
  expect(CSS.supports("appearance", "base-select")).toBe(server.browser !== "firefox");
});

test("an option may hold markup in all three", () => {
  const select = nativeList();
  expect(select.querySelector(".mark")).not.toBeNull();
});

test("without it, WebKit lays options out itself: their padding is ignored", () => {
  const select = nativeList();
  const height = select.options[0].getBoundingClientRect().height;
  expect(height >= 20).toBe(server.browser !== "webkit");
});

// WebKit draws the list itself: its options can't be pressed by the test driver, so this is shown in two engines.
// The same two engines then paint the pressed option in their own highlight, over the stylesheet's `:checked` rule.
test.skipIf(server.browser === "webkit")(
  "a click in a multiple list replaces the selection rather than toggling",
  async () => {
    const select = nativeList();
    await userEvent.click(select.options[2]);
    expect([...select.selectedOptions].map((option) => option.value)).toEqual(["c"]);
    expect(getComputedStyle(select.options[2]).backgroundColor).not.toBe("rgb(255, 0, 0)");
  },
);
