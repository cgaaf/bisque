// What the platform does with files, measured in each engine. These are the facts the File Upload family's design
// rests on (see the header of ./file-upload.rx and ../internal/impl/file-upload.ts); if one of them changes after a
// browser upgrade, the design needs another look.
//
// A real file drop (one the browser itself delivers, from outside the page) can only be produced in Chromium, through
// the DevTools protocol's Input.dispatchDragEvent. Playwright can't drag a file in Firefox or WebKit, and a
// DragEvent dispatched from script is untrusted, so the browser runs none of a drop's default actions for it. The
// tests marked "Chromium only" are therefore the only evidence here for what a native drop does.
import { afterEach, expect, test } from "vitest";
import { cdp, server } from "vitest/browser";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import zoneFixture from "./fixtures/zone.rx";

const fixtures = `${server.config.root}/src/file-upload/fixtures/files`;
const chromium = server.browser === "chromium";

function render(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  rendered.push(host);
  return host;
}

const rendered: HTMLElement[] = [];
afterEach(() => {
  for (const host of rendered.splice(0)) host.remove();
});

const transferOf = (...files: File[]) => {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  return transfer;
};
const png = (name: string) => new File([new Uint8Array(4)], name, { type: "image/png" });
const names = (input: HTMLInputElement) => [...(input.files ?? [])].map((file) => file.name);

test("input.files can be set from a DataTransfer: no event fires, and the files submit with the form", () => {
  const host = render(`<form><input type="file" name="docs" multiple accept="image/png"></form>`);
  const input = host.querySelector("input")!;
  const events: string[] = [];
  for (const type of ["input", "change"]) input.addEventListener(type, () => events.push(type));
  const a = png("a.png");
  input.files = transferOf(a, new File(["x"], "b.txt", { type: "text/plain" })).files;
  expect(names(input)).toEqual(["a.png", "b.txt"]);
  // The same File objects, not copies.
  expect(input.files![0]).toBe(a);
  expect(events).toEqual([]);
  // `accept` limits the picker only: a file of another type set from script is kept, and submits.
  const submitted = new FormData(host.querySelector("form")!).getAll("docs") as File[];
  expect(submitted.map((file) => file.name)).toEqual(["a.png", "b.txt"]);
});

test("a form reset empties a file input", () => {
  const host = render(`<form><input type="file" name="docs" multiple></form>`);
  const input = host.querySelector("input")!;
  input.files = transferOf(png("a.png")).files;
  host.querySelector("form")!.reset();
  expect(names(input)).toEqual([]);
});

test("an input without multiple keeps two files set from script, and submits both", () => {
  const host = render(`<form><input type="file" name="one"></form>`);
  const input = host.querySelector("input")!;
  input.files = transferOf(png("a.png"), png("b.png")).files;
  expect(names(input)).toEqual(["a.png", "b.png"]);
  expect(new FormData(host.querySelector("form")!).getAll("one")).toHaveLength(2);
});

test("a dispatched (untrusted) drop on a file input changes nothing: a page can't stand in for the native drop", async () => {
  const host = render(`<input type="file" multiple>`);
  const input = host.querySelector("input")!;
  const transfer = transferOf(png("a.png"));
  for (const type of ["dragenter", "dragover", "drop"])
    input.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
  await frame();
  expect(names(input)).toEqual([]);
});

test("a required file input hidden with display: none blocks the submit but can't be focused to say why", async () => {
  const host = render(
    `<form><input type="file" name="a" required style="display:none"><button>Send</button></form>` +
      `<form><input type="file" name="b" required style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)" tabindex="-1"><button>Send</button></form>`,
  );
  const [hiddenForm, clippedForm] = host.querySelectorAll("form");
  const submits: string[] = [];
  for (const form of [hiddenForm, clippedForm])
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submits.push(form.querySelector("input")!.name);
    });
  hiddenForm.requestSubmit();
  await frame();
  expect(submits).toEqual([]);
  expect(document.activeElement).not.toBe(hiddenForm.querySelector("input"));
  clippedForm.requestSubmit();
  await frame();
  expect(submits).toEqual([]);
  // Visually hidden and out of the tab order, it still takes focus for the browser's message.
  expect(document.activeElement).toBe(clippedForm.querySelector("input"));
});

// Where the test page sits in the window, for the DevTools protocol's window coordinates: the tests run in an iframe.
function windowPoint(element: Element) {
  const box = element.getBoundingClientRect();
  const iframe = window.frameElement!.getBoundingClientRect();
  const scale = iframe.width / window.innerWidth;
  return {
    x: iframe.left + (box.left + box.width / 2) * scale,
    y: iframe.top + (box.top + box.height / 2) * scale,
  };
}

/** A real file drag, delivered by the browser (Chromium only): by default enter, move over, drop. */
async function realDrop(
  target: Element,
  paths: string[],
  steps: ("dragEnter" | "dragOver" | "drop" | "dragCancel")[] = ["dragEnter", "dragOver", "drop"],
) {
  const session = cdp();
  const { x, y } = windowPoint(target);
  const data = { items: [], files: paths, dragOperationsMask: 1 };
  for (const type of steps)
    // oxlint-disable-next-line no-await-in-loop -- each step of the drag follows the one before
    await session.send("Input.dispatchDragEvent", { type, x, y, data });
  await new Promise((resolve) => setTimeout(resolve, 100));
}

test.runIf(chromium)(
  "Chromium only: a real drop on a visible file input fills it, without checking accept",
  async () => {
    const host = render(
      `<input type="file" accept="image/png" style="display:block;width:300px;height:80px">`,
    );
    const input = host.querySelector("input")!;
    const changes: number[] = [];
    input.addEventListener("change", () => changes.push(input.files!.length));
    await realDrop(input, [`${fixtures}/notes.txt`]);
    expect(names(input)).toEqual(["notes.txt"]);
    expect(changes).toEqual([1]);
    // A second drop replaces the first.
    await realDrop(input, [`${fixtures}/photo.png`]);
    expect(names(input)).toEqual(["photo.png"]);
    // Two files on an input without `multiple` are refused whole.
    await realDrop(input, [`${fixtures}/photo.png`, `${fixtures}/notes.txt`]);
    expect(names(input)).toEqual(["photo.png"]);
  },
);

test.runIf(chromium)(
  "Chromium only: an invisible full-size input over a zone takes a real drop with no script",
  async () => {
    const host = render(
      `<div style="position:relative;width:300px;height:100px"><span>Drop here</span><input type="file" multiple style="position:absolute;inset:0;width:100%;height:100%;opacity:0"></div>`,
    );
    const input = host.querySelector("input")!;
    await realDrop(host.querySelector("span")!, [`${fixtures}/photo.png`, `${fixtures}/notes.txt`]);
    expect(names(input)).toEqual(["photo.png", "notes.txt"]);
  },
);

test.runIf(chromium)(
  "Chromium only: a real drop on the zone is taken once, by the root's rules",
  async () => {
    const { getByLabelText, getByTestId } = mount(basic);
    const docs = getByLabelText("Documents") as HTMLInputElement;
    // The docs root takes images and PDFs of 1 to 1000 bytes.
    await realDrop(getByTestId("zone"), [`${fixtures}/photo.png`, `${fixtures}/notes.txt`]);
    await frame();
    expect(names(docs)).toEqual(["photo.png"]);
    expect(getByTestId("rejected").textContent).toBe("notes.txt:wrong-type");
    expect(getByTestId("changes").textContent).toBe("photo.png");
    expect(getByTestId("zone").hasAttribute("data-dragging")).toBe(false);
  },
);

test.runIf(chromium)(
  "Chromium only: a dropped folder arrives as a file, and the zone refuses it as a directory",
  async () => {
    const { getByLabelText, getByTestId } = mount(basic);
    await realDrop(getByTestId("zone"), [fixtures]);
    await frame();
    expect(names(getByLabelText("Documents") as HTMLInputElement)).toEqual([]);
    expect(getByTestId("rejected").textContent).toBe("files:directory");
  },
);

test.runIf(chromium)(
  "Chromium only: a real drop on a visible input inside the zone is taken once",
  async () => {
    const { getByLabelText, getByTestId } = mount(zoneFixture);
    const input = getByLabelText("Images") as HTMLInputElement;
    await realDrop(input, [`${fixtures}/photo.png`, `${fixtures}/notes.txt`]);
    await frame();
    expect(names(input)).toEqual(["photo.png"]);
    expect(getByTestId("changes").textContent).toBe("photo.png");
    expect(getByTestId("rejected").textContent).toBe("notes.txt:wrong-type");
    expect(getByTestId("list").querySelectorAll("li")).toHaveLength(1);
  },
);

test.runIf(chromium)(
  "Chromium only: during a real drag the page sees each file's MIME type, not its name",
  async () => {
    const host = render(`<div style="width:300px;height:80px">zone</div>`);
    const zone = host.firstElementChild!;
    const seen: string[] = [];
    zone.addEventListener("dragenter", (event) => {
      const transfer = (event as DragEvent).dataTransfer!;
      seen.push(
        [...transfer.items].map((item) => `${item.kind}/${item.type}`).join(","),
        `files:${transfer.files.length}`,
      );
    });
    await realDrop(zone, [`${fixtures}/notes.txt`], ["dragEnter", "dragCancel"]);
    expect(seen).toEqual(["file/text/plain", "files:0"]);
  },
);

test.runIf(chromium)(
  "Chromium only: the zone shows data-invalid during a real drag of a refused type",
  async () => {
    const { getByTestId } = mount(zoneFixture);
    const zone = getByTestId("zone");
    await realDrop(zone.querySelector("span")!, [`${fixtures}/notes.txt`], ["dragEnter", "dragOver"]);
    await frame();
    expect(zone.hasAttribute("data-dragging")).toBe(true);
    expect(zone.hasAttribute("data-invalid")).toBe(true);
    // Off the zone. (The protocol's dragCancel fires no dragleave, so leaving is what is tested here.)
    const outside = render(`<div style="width:300px;height:80px">elsewhere</div>`).firstElementChild!;
    await realDrop(outside, [`${fixtures}/notes.txt`], ["dragOver", "dragCancel"]);
    await frame();
    expect(zone.hasAttribute("data-dragging")).toBe(false);
    expect(zone.hasAttribute("data-invalid")).toBe(false);
  },
);

test.runIf(chromium)("Chromium only: a dropped folder's File can't be read", async () => {
  const host = render(`<div style="width:300px;height:80px">zone</div>`);
  const zone = host.firstElementChild!;
  const dropped: { file: File | null; directory: boolean }[] = [];
  zone.addEventListener("dragover", (event) => event.preventDefault());
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    const item = (event as DragEvent).dataTransfer!.items[0];
    dropped.push({ file: item.getAsFile(), directory: item.webkitGetAsEntry()?.isDirectory ?? false });
  });
  await realDrop(zone, [fixtures]);
  expect(dropped).toHaveLength(1);
  expect(dropped[0].directory).toBe(true);
  expect(dropped[0].file?.name).toBe("files");
  await expect(dropped[0].file!.arrayBuffer()).rejects.toBeInstanceOf(Error);
});
