// The File Upload family's rules for chosen files: pure logic, no browser needed.
import { describe, expect, test } from "vitest";
import {
  acceptsFile,
  checkFiles,
  fileLimit,
  formatFileSize,
  withoutFile,
  type FileCheck,
  type FileRules,
} from "../internal/impl/file-upload.ts";

const file = (name: string, type = "", size = 10) => new File([new Uint8Array(size)], name, { type });
const rules = (more: Partial<FileRules> = {}): FileRules => ({
  accept: undefined,
  multiple: true,
  maxFiles: undefined,
  maxFileSize: undefined,
  minFileSize: undefined,
  validate: undefined,
  ...more,
});
// By name: `toEqual` sees any two File objects as equal (they have no own enumerable fields).
const summary = (result: FileCheck) => ({
  files: result.files.map((f) => f.name),
  added: result.added.map((f) => f.name),
  rejected: result.rejected.map((r) => `${r.file.name}:${r.reasons.join("+")}`),
});

describe("acceptsFile", () => {
  test("takes anything without accept", () => {
    expect(acceptsFile(file("a.bin"), undefined)).toBe(true);
    expect(acceptsFile(file("a.bin"), "")).toBe(true);
  });
  test("matches extensions, ignoring case", () => {
    expect(acceptsFile(file("Report.PDF"), ".pdf")).toBe(true);
    expect(acceptsFile(file("report.pdf.txt"), ".pdf")).toBe(false);
  });
  test("matches MIME types and type/* wildcards", () => {
    expect(acceptsFile(file("a", "image/png"), "image/png")).toBe(true);
    expect(acceptsFile(file("a", "image/jpeg"), "image/png")).toBe(false);
    expect(acceptsFile(file("a", "image/jpeg"), "image/*")).toBe(true);
    expect(acceptsFile(file("a", "video/mp4"), "image/*")).toBe(false);
  });
  test("takes a file that matches any token of a list, and ignores tokens that aren't valid", () => {
    expect(acceptsFile(file("a.pdf"), "image/*, .pdf")).toBe(true);
    expect(acceptsFile(file("a.doc"), "image/*, .pdf")).toBe(false);
    expect(acceptsFile(file("a.doc"), "nonsense, .doc")).toBe(true);
  });
});

// A check of an app's own: "a" fails with one reason, "b" with two (the empty one is dropped), the rest pass.
const validate = (f: File) => (f.name === "a" ? "nope" : f.name === "b" ? ["one", "", "two"] : "");

describe("checkFiles", () => {
  test("adds to the list with multiple", () => {
    const a = file("a");
    const b = file("b");
    expect(summary(checkFiles([a], [b], rules()))).toEqual({ files: ["a", "b"], added: ["b"], rejected: [] });
  });
  test("replaces the list without multiple, taking only the first file", () => {
    const [a, b, c] = [file("a"), file("b"), file("c")];
    expect(summary(checkFiles([a], [b, c], rules({ multiple: false })))).toEqual({
      files: ["b"],
      added: ["b"],
      rejected: ["c:too-many"],
    });
  });
  test("keeps the list when nothing new is taken, with or without multiple", () => {
    const a = file("a.png", "image/png");
    const bad = file("b.txt", "text/plain");
    expect(summary(checkFiles([a], [bad], rules({ multiple: false, accept: "image/*" }))).files).toEqual([
      "a.png",
    ]);
    expect(summary(checkFiles([a], [bad], rules({ accept: "image/*" }))).files).toEqual(["a.png"]);
  });
  test("gives every reason a file fails, and a failed file takes no room", () => {
    const huge = file("huge.txt", "text/plain", 50);
    const ok = file("ok.png", "image/png", 5);
    const result = summary(
      checkFiles([], [huge, ok], rules({ accept: "image/*", maxFileSize: 20, maxFiles: 1 })),
    );
    expect(result.files).toEqual(["ok.png"]);
    expect(result.rejected).toEqual(["huge.txt:wrong-type+too-large"]);
  });
  test("refuses files smaller than minFileSize", () => {
    const empty = file("empty", "", 0);
    expect(summary(checkFiles([], [empty], rules({ minFileSize: 1 }))).rejected).toEqual(["empty:too-small"]);
  });
  test("refuses what doesn't fit once maxFiles is reached", () => {
    const [a, b, c] = [file("a"), file("b"), file("c")];
    const result = summary(checkFiles([a], [b, c], rules({ maxFiles: 2 })));
    expect(result.files).toEqual(["a", "b"]);
    expect(result.rejected).toEqual(["c:too-many"]);
  });
  test("passes on validate's reasons, one or several, and ignores empty ones", () => {
    const a = file("a");
    const b = file("b");
    const c = file("c");
    const result = summary(checkFiles([], [a, b, c], rules({ validate })));
    expect(result.files).toEqual(["c"]);
    expect(result.rejected).toEqual(["a:nope", "b:one+two"]);
  });
});

test("fileLimit is maxFiles with multiple, else one", () => {
  expect(fileLimit({ multiple: true, maxFiles: undefined })).toBe(Number.POSITIVE_INFINITY);
  expect(fileLimit({ multiple: true, maxFiles: 3 })).toBe(3);
  expect(fileLimit({ multiple: false, maxFiles: 3 })).toBe(1);
});

test("withoutFile removes that file object only", () => {
  const a = file("same");
  const b = file("same");
  const left = withoutFile([a, b], a);
  expect(left).toHaveLength(1);
  expect(left[0]).toBe(b);
});

test("formatFileSize uses powers of 1000 and the locale", () => {
  expect(formatFileSize(0, "en")).toBe("0 bytes");
  expect(formatFileSize(512, "en")).toBe("512 bytes");
  expect(formatFileSize(1500, "en")).toBe("1.5 kB");
  expect(formatFileSize(20_000_000, "en")).toBe("20 MB");
});
