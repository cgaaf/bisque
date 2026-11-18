// A tags input beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a
// plain write, and a prop or attribute of the tags input is computed from it: its own state (the tags, the
// highlight, the text being typed) must still follow the user while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [
  ["a prop of the root", "root-prop", "Root prop"],
  ["an attribute of a tag", "tag-attribute", "Tag attribute"],
] as const;

for (const [what, id, label] of cases) {
  test(`tags are added, highlighted and removed while an app action holds ${what}`, async () => {
    const mounted = mount(held);
    const { getByRole, getByTestId, user } = mounted;
    const input = getByRole<HTMLInputElement>("textbox", { name: label });
    const tags = () =>
      [...getByTestId(id).querySelectorAll("[data-testid=tag] span")].map((tag) => tag.textContent);
    const highlighted = () =>
      getByTestId(id).querySelector("[data-testid=tag][data-highlighted] span")?.textContent ?? null;
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");
    await user.click(input);
    await user.keyboard("b{Enter}c{Enter}d{Enter}e");
    await answered();
    expect(tags()).toEqual(["a", "b", "c", "d"]);
    expect(input.value).toBe("e");
    // Home doesn't move the caret in WebKit on macOS.
    input.setSelectionRange(0, 0);
    await user.keyboard("{ArrowLeft}");
    expect(highlighted()).toBe("d");
    await user.keyboard("{Backspace}");
    await answered();
    expect(tags()).toEqual(["a", "b", "c"]);
    expect(highlighted()).toBe("c");
    expect(getByTestId("step").textContent).toBe("1");
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(tags()).toEqual(["a", "b", "c"]);
    expect(input.value).toBe("e");
  });
}
