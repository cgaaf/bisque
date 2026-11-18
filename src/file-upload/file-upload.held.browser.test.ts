// A file upload beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a
// plain write, and a prop or attribute of the file upload is computed from it: the list of chosen files must still
// follow the user (picks and removals, several in a row) while the request is out.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const png = (name: string) => new File([new Uint8Array(4)], name, { type: "image/png" });
const names = (input: HTMLInputElement) => [...(input.files ?? [])].map((file) => file.name);
const listed = (list: HTMLElement) => [...list.querySelectorAll("li span")].map((span) => span.textContent);

const cases = [["a prop of the root", "root-prop", "Root prop"]] as const;

for (const [what, id, label] of cases) {
  test(`files are added and removed while an app action holds ${what}`, async () => {
    const { getByLabelText, getByRole, getByTestId, user } = mount(held);
    const input = getByLabelText(label) as HTMLInputElement;
    const list = getByTestId(id);
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    await user.upload(input, [png("a.png"), png("b.png")]);
    await answered();
    expect(listed(list)).toEqual(["a.png", "b.png"]);
    await user.upload(input, png("c.png"));
    await answered();
    expect(listed(list)).toEqual(["a.png", "b.png", "c.png"]);
    await user.click(getByRole("button", { name: "Remove a.png" }));
    await answered();
    expect(listed(list)).toEqual(["b.png", "c.png"]);
    await user.upload(input, png("d.png"));
    await answered();
    await user.click(getByRole("button", { name: "Remove c.png" }));
    await answered();
    expect(listed(list)).toEqual(["b.png", "d.png"]);
    expect(names(input)).toEqual(["b.png", "d.png"]);
    expect(getByTestId("step").textContent).toBe("1");
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(listed(list)).toEqual(["b.png", "d.png"]);
    expect(names(input)).toEqual(["b.png", "d.png"]);
  });
}
