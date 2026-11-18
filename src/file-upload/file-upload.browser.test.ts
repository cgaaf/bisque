// File Upload in Chromium, Firefox and WebKit. Picks are real: `user.upload` sets files on the input through the
// browser driver (Playwright's setInputFiles), which fires the browser's own `input` and `change`. Drops are
// synthetic in every engine here (a DragEvent dispatched with a DataTransfer built in the page): Playwright can't
// drag a file from outside the page in Firefox or WebKit. A real, trusted file drop is tested in Chromium only, in
// ./file-upload.platform.browser.test.ts.
import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import field from "./fixtures/field.rx";
import zoneFixture from "./fixtures/zone.rx";

const png = (name: string, size = 10) => new File([new Uint8Array(size)], name, { type: "image/png" });
const pdf = (name: string, size = 10) => new File([new Uint8Array(size)], name, { type: "application/pdf" });
const text = (name: string) => new File(["hello"], name, { type: "text/plain" });

const names = (input: HTMLInputElement) => [...(input.files ?? [])].map((file) => file.name);
const listed = (list: HTMLElement) =>
  [...list.querySelectorAll("li span:first-of-type")].map((span) => span.textContent);

function setup() {
  const mounted = mount(basic);
  const input = (name: string) => mounted.getByLabelText(name) as HTMLInputElement;
  const out = (id: string) => mounted.getByTestId(id).textContent;
  const form = mounted.getByTestId("form") as HTMLFormElement;
  return { ...mounted, input, out, form };
}

/** Dispatches a drag of `files` (and `strings`, as `type: data`) over `target`, as a browser would deliver it. */
function drag(target: Element, type: string, files: File[], strings: Record<string, string> = {}) {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  for (const [kind, data] of Object.entries(strings)) transfer.setData(kind, data);
  const event = new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    dataTransfer: transfer,
  });
  target.dispatchEvent(event);
  return event;
}

async function drop(target: Element, files: File[]) {
  drag(target, "dragenter", files);
  drag(target, "dragover", files);
  const event = drag(target, "drop", files);
  await frame();
  return event;
}

test("a pick shows in the list, stays in the input, and submits with the form", async () => {
  const { input, out, form, getByTestId, user } = setup();
  const docs = input("Documents");
  expect(docs.type).toBe("file");
  expect(docs.multiple).toBe(true);
  expect(docs.accept).toBe("image/*,.pdf");
  await user.upload(docs, [png("a.png"), pdf("b.pdf")]);
  await frame();
  expect(listed(getByTestId("docs-list"))).toEqual(["a.png", "b.pdf"]);
  expect(names(docs)).toEqual(["a.png", "b.pdf"]);
  expect(out("changes")).toBe("a.png,b.pdf");
  // The input holds the very File objects the list shows, and the form submits them.
  const submitted = new FormData(form).getAll("docs") as File[];
  expect(submitted.map((file) => file.name)).toEqual(["a.png", "b.pdf"]);
  expect(submitted[0]).toBeInstanceOf(File);
  expect(submitted[0].size).toBe(10);
});

test("with multiple, a second pick adds to the list, though the browser's picker replaced its selection", async () => {
  const { input, out, form, getByTestId, user } = setup();
  const docs = input("Documents");
  await user.upload(docs, [png("a.png")]);
  await user.upload(docs, [pdf("b.pdf")]);
  await frame();
  expect(listed(getByTestId("docs-list"))).toEqual(["a.png", "b.pdf"]);
  expect(names(docs)).toEqual(["a.png", "b.pdf"]);
  expect((new FormData(form).getAll("docs") as File[]).map((file) => file.name)).toEqual(["a.png", "b.pdf"]);
  expect(out("changes")).toBe("a.png|a.png,b.pdf");
});

test("files that break a rule are refused with their reasons, and the rest are taken", async () => {
  const { input, out, getByTestId, user } = setup();
  const docs = input("Documents");
  await user.upload(docs, [
    png("a.png"),
    text("notes.txt"),
    png("huge.png", 2000),
    png("empty.png", 0),
    png("bad.png"),
    pdf("b.pdf"),
    png("c.png"),
    png("d.png"),
  ]);
  await frame();
  expect(listed(getByTestId("docs-list"))).toEqual(["a.png", "b.pdf", "c.png"]);
  // The input doesn't keep what the browser put there and the root refused.
  expect(names(docs)).toEqual(["a.png", "b.pdf", "c.png"]);
  expect(out("rejected")).toBe(
    "notes.txt:wrong-type|huge.png:too-large|empty.png:too-small|bad.png:bad-name|d.png:too-many",
  );
  // Full: one more is refused as too many, and the list doesn't change.
  await user.upload(docs, [png("e.png")]);
  await frame();
  expect(names(docs)).toEqual(["a.png", "b.pdf", "c.png"]);
  expect(out("rejected")).toMatch(/\|e\.png:too-many$/);
  expect(out("changes")).toBe("a.png,b.pdf,c.png");
});

test("without multiple, a new file replaces the one chosen, and a refused one leaves it", async () => {
  const { input, getByTestId, user } = setup();
  const avatar = input("Avatar");
  expect(avatar.multiple).toBe(false);
  await user.upload(avatar, png("one.png"));
  await user.upload(avatar, png("two.png"));
  await frame();
  expect(listed(getByTestId("avatar-list"))).toEqual(["two.png"]);
  expect(names(avatar)).toEqual(["two.png"]);
  await user.upload(avatar, text("notes.txt"));
  await frame();
  expect(listed(getByTestId("avatar-list"))).toEqual(["two.png"]);
  expect(names(avatar)).toEqual(["two.png"]);
});

test("a remove button is labelled with its file and takes the file out of the list and the input", async () => {
  const { input, out, form, getByRole, getByTestId, user } = setup();
  const docs = input("Documents");
  await user.upload(docs, [png("a.png"), pdf("b.pdf"), png("c.png")]);
  await user.click(getByRole("button", { name: "Remove b.pdf" }));
  await frame();
  expect(listed(getByTestId("docs-list"))).toEqual(["a.png", "c.png"]);
  expect(names(docs)).toEqual(["a.png", "c.png"]);
  expect((new FormData(form).getAll("docs") as File[]).map((file) => file.name)).toEqual(["a.png", "c.png"]);
  expect(out("changes")).toBe("a.png,b.pdf,c.png|a.png,c.png");
});

test("removing from the keyboard moves focus to the next remove button, then the previous, then the trigger", async () => {
  const { input, getByRole, user } = setup();
  await user.upload(input("Documents"), [png("a.png"), pdf("b.pdf"), png("c.png")]);
  getByRole("button", { name: "Remove b.pdf" }).focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe("Remove c.png");
  await user.keyboard(" ");
  await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe("Remove a.png");
  await user.keyboard("{Enter}");
  await expect.poll(() => document.activeElement).toBe(getByRole("button", { name: "Choose documents" }));
});

test("an image's preview is an object URL, revoked when the file leaves the list", async () => {
  const { input, getByRole, getByTestId, queryAllByTestId, user } = setup();
  await user.upload(input("Documents"), [png("a.png"), pdf("b.pdf")]);
  await frame();
  // Only the image has one.
  const previews = queryAllByTestId("preview") as HTMLImageElement[];
  expect(previews).toHaveLength(1);
  const url = previews[0].getAttribute("src")!;
  expect(url).toMatch(/^blob:/);
  expect(previews[0].getAttribute("alt")).toBe("");
  expect((await fetch(url)).ok).toBe(true);
  await user.click(getByRole("button", { name: "Remove a.png" }));
  await frame();
  expect(getByTestId("docs-list").querySelector("img")).toBeNull();
  await expect(fetch(url)).rejects.toBeInstanceOf(TypeError);
});

test("the trigger clicks the input during its own press, so the browser lets it open the picker", async () => {
  const { input, getByRole, user } = setup();
  const docs = input("Documents");
  const seen: boolean[] = [];
  // Opening the picker needs a user activation; the trigger's click on the input must happen while it lasts.
  docs.addEventListener("click", (event) => {
    seen.push(navigator.userActivation?.isActive ?? true);
    event.preventDefault();
  });
  await user.click(getByRole("button", { name: "Choose documents" }));
  expect(seen).toEqual([true]);
});

test("controlled: the list and the input follow the owner", async () => {
  const { input, out, getByRole, getByTestId, user } = setup();
  const controlled = input("Controlled");
  await user.upload(controlled, [png("a.png"), png("b.png")]);
  await frame();
  expect(out("chosen")).toBe("a.png,b.png");
  expect(listed(getByTestId("controlled-list"))).toEqual(["a.png", "b.png"]);
  expect(names(controlled)).toEqual(["a.png", "b.png"]);
  await user.click(getByRole("button", { name: "Clear from outside" }));
  await frame();
  expect(listed(getByTestId("controlled-list"))).toEqual([]);
  expect(names(controlled)).toEqual([]);
});

test("controlled: an owner that refuses the change leaves the input empty", async () => {
  const { input, out, user } = setup();
  const refused = input("Refused");
  await user.upload(refused, [png("a.png")]);
  await frame();
  expect(out("controlled-changes")).toBe("1");
  expect(names(refused)).toEqual([]);
});

test("disabled: the input and trigger are natively disabled, and the zone takes no drop", async () => {
  const { input, getByRole, getByTestId } = setup();
  expect(input("Locked").disabled).toBe(true);
  expect(getByRole("button", { name: "Choose locked" }).matches(":disabled")).toBe(true);
  const zone = getByTestId("locked-zone");
  expect(zone.hasAttribute("data-disabled")).toBe(true);
  const over = drag(zone, "dragover", [png("a.png")]);
  expect(over.defaultPrevented).toBe(false);
  drag(zone, "dragenter", [png("a.png")]);
  expect(zone.hasAttribute("data-dragging")).toBe(false);
  const dropped = drag(zone, "drop", [png("a.png")]);
  expect(dropped.defaultPrevented).toBe(false);
  expect(names(input("Locked"))).toEqual([]);
});

test("a form reset empties the list and the input, and reports it once", async () => {
  const { input, out, getByRole, getByTestId, user } = setup();
  const docs = input("Documents");
  await user.upload(docs, [png("a.png")]);
  await user.click(getByRole("button", { name: "Reset" }));
  await expect.poll(() => listed(getByTestId("docs-list"))).toEqual([]);
  expect(names(docs)).toEqual([]);
  expect(out("changes")).toBe("a.png|");
  // A reset with nothing chosen reports nothing.
  await user.click(getByRole("button", { name: "Reset" }));
  await frame();
  await frame();
  expect(out("changes")).toBe("a.png|");
});

test("a form reset keeps a controlled list whose owner keeps it: the input is given the files again", async () => {
  const { input, form, getByRole, user } = setup();
  const kept = input("Kept");
  await user.upload(kept, [png("a.png"), png("b.png")]);
  await frame();
  expect(names(kept)).toEqual(["a.png", "b.png"]);
  await user.click(getByRole("button", { name: "Reset" }));
  await expect.poll(() => names(kept)).toEqual(["a.png", "b.png"]);
  await frame();
  expect(names(kept)).toEqual(["a.png", "b.png"]);
  expect((new FormData(form).getAll("kept") as File[]).map((file) => file.name)).toEqual(["a.png", "b.png"]);
});

test("without multiple, the input holds only the first of the files an owner passes", async () => {
  const { input, form, getByRole, getByTestId, user } = setup();
  await user.click(getByRole("button", { name: "Give two" }));
  await frame();
  expect(listed(getByTestId("pair-list"))).toEqual(["first.png", "second.png"]);
  expect(names(input("Pair"))).toEqual(["first.png"]);
  expect(new FormData(form).getAll("pair")).toHaveLength(1);
});

test("a drop on the zone goes through the same rules and adds to the list", async () => {
  const { input, out, getByTestId, user } = setup();
  const zone = getByTestId("zone");
  await user.upload(input("Documents"), [png("a.png")]);
  const event = await drop(zone, [pdf("b.pdf"), text("notes.txt")]);
  // Prevented, so the browser doesn't open the file in place of the page.
  expect(event.defaultPrevented).toBe(true);
  expect(listed(getByTestId("docs-list"))).toEqual(["a.png", "b.pdf"]);
  expect(names(input("Documents"))).toEqual(["a.png", "b.pdf"]);
  expect(out("rejected")).toBe("notes.txt:wrong-type");
  expect(zone.hasAttribute("data-dragging")).toBe(false);
});

test("data-dragging holds while the drag crosses the zone's children, and ends when it leaves", async () => {
  const { getByTestId } = setup();
  const zone = getByTestId("zone");
  const child = getByTestId("zone-child");
  const files = [png("a.png")];
  expect(zone.hasAttribute("data-dragging")).toBe(false);
  expect(drag(zone, "dragenter", files).defaultPrevented).toBe(true);
  expect(drag(zone, "dragover", files).defaultPrevented).toBe(true);
  await frame();
  expect(zone.hasAttribute("data-dragging")).toBe(true);
  expect(zone.hasAttribute("data-invalid")).toBe(false);
  // Into a child: the child's dragenter comes before the zone's dragleave, which is where a naive zone flickers.
  drag(child, "dragenter", files);
  drag(zone, "dragleave", files);
  await frame();
  expect(zone.hasAttribute("data-dragging")).toBe(true);
  // Back out to the zone, then out of it.
  drag(zone, "dragenter", files);
  drag(child, "dragleave", files);
  await frame();
  expect(zone.hasAttribute("data-dragging")).toBe(true);
  drag(zone, "dragleave", files);
  await frame();
  expect(zone.hasAttribute("data-dragging")).toBe(false);
});

test("a drag cancelled anywhere (dragend) ends data-dragging", async () => {
  const { getByTestId } = setup();
  const zone = getByTestId("zone");
  drag(zone, "dragenter", [png("a.png")]);
  await frame();
  expect(zone.hasAttribute("data-dragging")).toBe(true);
  document.body.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
  await frame();
  expect(zone.hasAttribute("data-dragging")).toBe(false);
});

test("data-invalid while the drag carries a type accept rules out, or more files than fit", async () => {
  const { getByTestId } = setup();
  const zone = getByTestId("zone");
  // The docs root takes "image/*,.pdf": the extension means a MIME type alone can't rule a file out.
  drag(zone, "dragenter", [text("notes.txt")]);
  await frame();
  expect(zone.hasAttribute("data-dragging")).toBe(true);
  expect(zone.hasAttribute("data-invalid")).toBe(false);
  drag(zone, "dragleave", []);
  // Four files where three fit.
  drag(zone, "dragenter", [png("a.png"), png("b.png"), png("c.png"), png("d.png")]);
  await frame();
  expect(zone.hasAttribute("data-invalid")).toBe(true);
  drag(zone, "dragleave", []);
  await frame();
  expect(zone.hasAttribute("data-invalid")).toBe(false);
  expect(zone.hasAttribute("data-dragging")).toBe(false);
});

test("data-invalid while a dragged file's MIME type is one a MIME-only accept rules out", async () => {
  const { getByTestId } = mount(zoneFixture);
  const zone = getByTestId("zone");
  drag(zone, "dragenter", [text("notes.txt")]);
  await frame();
  expect(zone.hasAttribute("data-dragging")).toBe(true);
  expect(zone.hasAttribute("data-invalid")).toBe(true);
  drag(zone, "dragleave", [text("notes.txt")]);
  drag(zone, "dragenter", [png("a.png")]);
  await frame();
  expect(zone.hasAttribute("data-invalid")).toBe(false);
});

test("a drag that carries no files is left alone: not prevented, no drag state", async () => {
  const { getByTestId } = setup();
  const zone = getByTestId("zone");
  const enter = drag(zone, "dragenter", [], { "text/plain": "some text" });
  const over = drag(zone, "dragover", [], { "text/plain": "some text" });
  await frame();
  expect(enter.defaultPrevented).toBe(false);
  expect(over.defaultPrevented).toBe(false);
  expect(zone.hasAttribute("data-dragging")).toBe(false);
  const dropped = drag(zone, "drop", [], { "text/plain": "some text" });
  expect(dropped.defaultPrevented).toBe(false);
});

test("field: required, labelled, described, and validated by the browser's own constraint", async () => {
  const { getByLabelText, getByRole, getByTestId, user } = mount(field);
  const resume = getByLabelText("Résumé") as HTMLInputElement;
  expect(resume.required).toBe(true);
  expect(resume.getAttribute("aria-describedby")).toContain(getByTestId("resume-description").id);
  expect(resume.name).toBe("resume");
  expect(resume.validity.valueMissing).toBe(true);
  await user.click(getByRole("button", { name: "Submit" }));
  await expect.poll(() => getByTestId("resume-root").hasAttribute("data-invalid")).toBe(true);
  expect(getByTestId("submitted").textContent).toBe("");
  await user.upload(resume, new File(["cv"], "cv.pdf", { type: "application/pdf" }));
  await frame();
  expect(resume.validity.valueMissing).toBe(false);
  await user.click(getByRole("button", { name: "Submit" }));
  await expect.poll(() => getByTestId("submitted").textContent).toBe("resume=cv.pdf");
  expect(getByTestId("resume-root").hasAttribute("data-invalid")).toBe(false);
  expect(getByTestId("resume-root").hasAttribute("data-filled")).toBe(true);
});

test("field: a new file of the same count replaces the old one in the submitted value", async () => {
  const { getByLabelText, getByRole, getByTestId, user } = mount(field);
  const resume = getByLabelText("Résumé") as HTMLInputElement;
  await user.upload(resume, new File(["one"], "cv.pdf", { type: "application/pdf" }));
  await user.upload(resume, new File(["two"], "cv2.pdf", { type: "application/pdf" }));
  await frame();
  await user.click(getByRole("button", { name: "Submit" }));
  await expect.poll(() => getByTestId("submitted").textContent).toBe("resume=cv2.pdf");
});

test("field: a disabled FieldRoot disables the input and trigger", async () => {
  const { getByLabelText, getByRole } = mount(field);
  expect((getByLabelText("Cover letter") as HTMLInputElement).disabled).toBe(true);
  expect(getByRole("button", { name: "Choose a cover letter" }).matches(":disabled")).toBe(true);
});
