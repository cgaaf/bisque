// A dialog (and an alert dialog, which is Dialog underneath) beside an app action that is still waiting for its
// server (fixtures/held.rx). The action holds a plain write, and a prop or attribute of the dialog is computed from
// it: the dialog's own state (open or closed) must still follow the user while the request is out.
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
  ["an attribute of the trigger", "trigger-attribute", "Trigger attribute"],
  ["an attribute of the popup", "popup-attribute", "Popup attribute"],
  ["an attribute of an alert dialog's trigger", "alert-trigger-attribute", "Alert trigger attribute"],
  ["an attribute of an alert dialog's popup", "alert-popup-attribute", "Alert popup attribute"],
] as const;

// Not fixed yet, any of it: in Dialog even `latest mergeProps(own, rest)` on the trigger breaks "a controlled dialog
// whose owner agrees late follows the owner" (UNSTABLE_MEMO_OUTPUT), so the dialog still waits for the app's request.
// `test.fails` goes red when someone fixes it: make these plain tests then.
for (const [what, id, label] of cases) {
  test.fails(`it opens and closes while an app action holds ${what}`, async () => {
    const { getByRole, getByTestId, user } = mount(held);
    const popup = getByTestId<HTMLDialogElement>(id);
    const trigger = getByRole("button", { name: label });
    await user.click(getByRole("button", { name: "Next" }));
    expect(waiting()).toEqual(["step"]);
    expect(getByTestId("step").textContent).toBe("1");
    await user.click(trigger);
    await answered();
    expect(popup.open).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await user.click(popup.querySelector("button")!);
    await expect.poll(() => popup.open).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    release("step");
    await answered();
    expect(getByTestId("step").textContent).toBe("2");
    expect(popup.open).toBe(false);
  });
}
