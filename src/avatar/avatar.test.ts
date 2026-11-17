import { afterEach, beforeEach, expect, test } from "vitest";
import { flush, mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

// jsdom never loads images, so `new Image()` is replaced by one the test settles by hand.
type FakeImage = {
  src: string;
  srcset: string;
  crossOrigin: string | null;
  referrerPolicy: string;
  complete: boolean;
  naturalWidth: number;
  listeners: Record<string, () => void>;
  addEventListener: (type: string, listener: () => void) => void;
};

let images: FakeImage[] = [];
const OriginalImage = window.Image;

beforeEach(() => {
  images = [];
  window.Image = function FakeImageConstructor() {
    const image: FakeImage = {
      src: "",
      srcset: "",
      crossOrigin: null,
      referrerPolicy: "",
      complete: false,
      naturalWidth: 0,
      listeners: {},
      addEventListener(type, listener) {
        image.listeners[type] = listener;
      },
    };
    images.push(image);
    return image;
  } as unknown as typeof window.Image;
});

afterEach(() => {
  window.Image = OriginalImage;
});

function settle(src: string, outcome: "load" | "error") {
  const image = images.findLast((candidate) => candidate.src === src);
  if (!image) throw new Error(`no image requested for ${src}`);
  image.listeners[outcome]?.();
  flush();
}

test("shows the fallback while the image loads, then the image instead", () => {
  const { getByTestId, queryByTestId, getByRole } = mount(basic);
  expect(getByTestId("root").tagName).toBe("SPAN");
  expect(getByTestId("root").className).toBe("mine");
  expect(queryByTestId("image")).toBeNull();
  expect(getByTestId("fallback").textContent).toBe("AL");

  settle("/first.png", "load");
  const image = getByRole("img", { name: "Ada" }) as HTMLImageElement;
  expect(image).toBe(getByTestId("image"));
  expect(image.getAttribute("src")).toBe("/first.png");
  expect(image.className).toBe("photo");
  expect(queryByTestId("fallback")).toBeNull();
  expect(getByTestId("log").textContent).toBe("loading,loaded,");
});

test("keeps the fallback when the image fails", () => {
  const { getByTestId, queryByTestId } = mount(basic);
  settle("/first.png", "error");
  expect(queryByTestId("image")).toBeNull();
  expect(getByTestId("fallback")).toBeTruthy();
  expect(getByTestId("log").textContent).toBe("loading,error,");
});

test("a new source is loaded again before it shows", async () => {
  const { getByTestId, queryByTestId, getByRole, user } = mount(basic);
  settle("/first.png", "load");
  expect(queryByTestId("fallback")).toBeNull();
  await user.click(getByRole("button", { name: "Change" }));
  await expect.poll(() => queryByTestId("image")).toBeNull();
  expect(getByTestId("fallback")).toBeTruthy();
  settle("/second.png", "load");
  expect(getByTestId("image").getAttribute("src")).toBe("/second.png");
  expect(queryByTestId("fallback")).toBeNull();
});

function CachedImage() {
  return { complete: true, naturalWidth: 10, src: "", srcset: "", addEventListener() {} };
}

test("a cached image shows at once", () => {
  window.Image = CachedImage as unknown as typeof window.Image;
  const { getAllByRole, queryByTestId } = mount(basic);
  expect(getAllByRole("img").length).toBe(2);
  expect(queryByTestId("fallback")).toBeNull();
});

test("without an image the fallback shows", () => {
  const { getByTestId } = mount(basic);
  expect(getByTestId("initials").textContent).toBe("NO");
});

test("a delayed fallback waits", async () => {
  const { queryByTestId } = mount(basic);
  expect(queryByTestId("delayed")).toBeNull();
  await expect.poll(() => queryByTestId("delayed")).not.toBeNull();
});
