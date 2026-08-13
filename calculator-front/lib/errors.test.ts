import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { FALLBACK_ERROR, friendlyError } from "./errors";

// Each key is a message produced by the Go backend. If one drifts, the UI
// silently degrades to the generic fallback, so they are asserted verbatim
// against the strings in calculator-back/internal/operations.
describe("backend messages are translated", () => {
  it.each([
    ["cannot divide by zero", "Can't divide by zero"],
    [
      "cannot calculate square root of a negative number",
      "No square root of a negative number",
    ],
    ["cannot calculate percentage of zero", "Can't take a percentage of zero"],
    ["result is not a finite number", "That number is too big to show"],
    ["missing query parameters 'a' and 'b'", "Enter both numbers first"],
    ["invalid numeric values for 'a' or 'b'", "Those aren't valid numbers"],
    ["'a' and 'b' must be finite numbers", "Those numbers are out of range"],
    ["missing query parameter 'a'", "Enter a number first"],
    ["invalid numeric value for 'a'", "That isn't a valid number"],
    ["'a' must be a finite number", "That number is out of range"],
    ["Network error", "Can't reach the calculator"],
    ["Malformed response", "Unexpected reply from the server"],
  ])("maps %s", (backendMessage, friendly) => {
    expect(friendlyError(new ApiError(backendMessage))).toBe(friendly);
  });
});

describe("status fallbacks", () => {
  it.each([
    "Request failed (500)",
    "Request failed (404)",
    "Request failed (502)",
  ])("maps %s to a reachability message", (message) => {
    expect(friendlyError(new ApiError(message))).toBe(
      "Couldn't reach the calculator",
    );
  });

  it("does not match a message that merely mentions the prefix later", () => {
    expect(friendlyError(new ApiError("nope: Request failed (500)"))).toBe(
      FALLBACK_ERROR,
    );
  });
});

describe("unrecognized input", () => {
  it("falls back for an unknown ApiError message", () => {
    expect(friendlyError(new ApiError("something unexpected"))).toBe(
      FALLBACK_ERROR,
    );
  });

  it("falls back for an empty ApiError message", () => {
    expect(friendlyError(new ApiError(""))).toBe(FALLBACK_ERROR);
  });

  // Anything that is not an ApiError is a bug rather than a backend response,
  // so it must never be shown to the user directly.
  it.each([
    ["a plain Error", new Error("cannot divide by zero")],
    ["a TypeError", new TypeError("boom")],
    ["a string", "cannot divide by zero"],
    ["null", null],
    ["undefined", undefined],
    ["a number", 42],
    ["an object", { message: "cannot divide by zero" }],
  ])("falls back for %s", (_label, value) => {
    expect(friendlyError(value)).toBe(FALLBACK_ERROR);
  });
});
