import { describe, expect, it } from "vitest";
import { friendlyError, isUserRejection } from "./errors";

describe("isUserRejection", () => {
  it("detects wallet rejection messages", () => {
    expect(isUserRejection(new Error("User rejected the request"))).toBe(true);
    expect(isUserRejection(new Error("Transaction declined"))).toBe(true);
    expect(isUserRejection(new Error("request denied by user"))).toBe(true);
  });

  it("does not flag unrelated errors", () => {
    expect(isUserRejection(new Error("network timeout"))).toBe(false);
  });
});

describe("friendlyError", () => {
  it("maps auth failures to a not-authorized message", () => {
    expect(friendlyError(new Error("require_auth failed"))).toMatch(
      /Not authorized/
    );
  });

  it("maps contract panics to readable text", () => {
    expect(friendlyError(new Error("escrow not found"))).toMatch(
      /does not exist/
    );
    expect(friendlyError(new Error("milestone is not locked"))).toMatch(
      /already released or refunded/
    );
    expect(friendlyError(new Error("nothing to refund"))).toMatch(
      /nothing left to refund/
    );
  });

  it("passes through unknown errors verbatim", () => {
    expect(friendlyError(new Error("weird failure"))).toBe("weird failure");
  });
});
