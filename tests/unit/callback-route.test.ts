import { describe, expect, it } from "vitest";
import { getSafeCallbackRedirectPath } from "@/lib/auth/callback";

describe("auth callback redirect safety", () => {
  it("defaults missing next values to the app root", () => {
    expect(getSafeCallbackRedirectPath(null)).toBe("/");
  });

  it("accepts a valid relative path", () => {
    expect(getSafeCallbackRedirectPath("/my-schedule")).toBe("/my-schedule");
  });

  it("accepts a nested valid relative path", () => {
    expect(getSafeCallbackRedirectPath("/admin/schedule?view=review#publish")).toBe(
      "/admin/schedule?view=review#publish",
    );
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeCallbackRedirectPath("//evil.example")).toBe("/");
  });

  it("rejects absolute external URLs", () => {
    expect(getSafeCallbackRedirectPath("https://evil.example")).toBe("/");
  });

  it("rejects malformed URLs", () => {
    expect(getSafeCallbackRedirectPath("http://[::1")).toBe("/");
  });
});
