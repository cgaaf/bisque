import { describe, expect, test } from "vitest";
import { targetId } from "../internal/impl/table-of-contents.ts";

describe("targetId", () => {
  test("reads the id from a same-document fragment link", () => {
    expect(targetId("#intro")).toBe("intro");
    expect(targetId("#café")).toBe("café");
  });

  test("decodes a percent-encoded fragment, and keeps one that isn't valid encoding", () => {
    expect(targetId("#caf%C3%A9")).toBe("café");
    expect(targetId("#100%")).toBe("100%");
  });

  test("is undefined for anything that isn't a fragment of this document", () => {
    expect(targetId(undefined)).toBe(undefined);
    expect(targetId("")).toBe(undefined);
    expect(targetId("#")).toBe(undefined);
    expect(targetId("/guide#intro")).toBe(undefined);
    expect(targetId("https://example.com/#intro")).toBe(undefined);
  });
});
