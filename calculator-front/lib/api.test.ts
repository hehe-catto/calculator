import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  calculate,
  calculateUnary,
  type BinaryOperator,
} from "./api";

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const calledUrl = () => fetchMock.mock.calls[0][0] as string;

describe("calculate", () => {
  it.each<[BinaryOperator, string]>([
    ["+", "sum"],
    ["-", "sub"],
    ["×", "mul"],
    ["÷", "div"],
    ["^", "exp"],
    ["%", "per"],
  ])("maps %s to the %s endpoint", async (op, endpoint) => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 1 }));

    await calculate(2, 3, op);

    expect(calledUrl()).toBe(`/v1/operations/${endpoint}?a=2&b=3`);
  });

  it("returns the numeric result", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 5 }));

    await expect(calculate(2, 3, "+")).resolves.toBe(5);
  });

  it("returns a zero result rather than treating it as absent", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 0 }));

    await expect(calculate(0, 0, "+")).resolves.toBe(0);
  });

  it("returns negative results", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: -5 }));

    await expect(calculate(-2, -3, "+")).resolves.toBe(-5);
  });

  it("encodes negative and fractional operands", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 0 }));

    await calculate(-2.5, 0.5, "+");

    expect(calledUrl()).toBe("/v1/operations/sum?a=-2.5&b=0.5");
  });

  it("forwards the abort signal to fetch", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 1 }));
    const controller = new AbortController();

    await calculate(1, 2, "+", controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), {
      signal: controller.signal,
    });
  });
});

describe("calculateUnary", () => {
  it("maps √ to the sqrt endpoint with only an 'a' param", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 3 }));

    await expect(calculateUnary(9, "√")).resolves.toBe(3);
    expect(calledUrl()).toBe("/v1/operations/sqrt?a=9");
  });

  it("forwards the abort signal to fetch", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 3 }));
    const controller = new AbortController();

    await calculateUnary(9, "√", controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), {
      signal: controller.signal,
    });
  });
});

describe("error handling", () => {
  it("surfaces the backend error message verbatim", async () => {
    // A Response body can only be read once, so each call needs a fresh one.
    fetchMock.mockImplementation(async () =>
      jsonResponse({ error: "cannot divide by zero" }, { status: 400 }),
    );

    await expect(calculate(1, 0, "÷")).rejects.toThrow(ApiError);
    await expect(calculate(1, 0, "÷")).rejects.toThrow("cannot divide by zero");
  });

  it("falls back to the status when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("gateway exploded", { status: 502 }),
    );

    await expect(calculate(1, 2, "+")).rejects.toThrow("Request failed (502)");
  });

  it("falls back to the status when the error body has no error field", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ nope: true }, { status: 500 }));

    await expect(calculate(1, 2, "+")).rejects.toThrow("Request failed (500)");
  });

  it("falls back to the status when the error field is not a string", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 42 }, { status: 400 }));

    await expect(calculate(1, 2, "+")).rejects.toThrow("Request failed (400)");
  });

  it("rejects a success body with no result field", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ nope: true }));

    await expect(calculate(1, 2, "+")).rejects.toThrow("Malformed response");
  });

  it("rejects a success body whose result is not a number", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: "5" }));

    await expect(calculate(1, 2, "+")).rejects.toThrow("Malformed response");
  });

  it("rejects a success body that is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(calculate(1, 2, "+")).rejects.toThrow("Malformed response");
  });

  it("converts a network failure into an ApiError", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(calculate(1, 2, "+")).rejects.toThrow("Network error");
  });

  // The state machine distinguishes an abort from a real failure, so it must
  // not be flattened into an ApiError.
  it("rethrows an AbortError instead of converting it", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    fetchMock.mockRejectedValue(abortError);

    await expect(calculate(1, 2, "+")).rejects.toBe(abortError);
    await expect(calculate(1, 2, "+")).rejects.not.toBeInstanceOf(ApiError);
  });
});
