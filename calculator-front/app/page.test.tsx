import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api";
import Page from "./page";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    calculate: vi.fn(),
    calculateUnary: vi.fn(),
  };
});

const { calculate, calculateUnary } = await import("@/lib/api");
const calculateMock = vi.mocked(calculate);
const calculateUnaryMock = vi.mocked(calculateUnary);

beforeEach(() => {
  calculateMock.mockReset();
  calculateUnaryMock.mockReset();
});

const setup = () => {
  const user = userEvent.setup();
  const { container } = render(<Page />);

  const entry = () => container.querySelector(".display-entry")!.textContent;
  // An empty expression renders as a placeholder space to keep the row height
  // stable, so it is normalized here to keep assertions about intent.
  const expression = () =>
    container.querySelector(".display-expression")!.textContent!.trim();

  const press = (name: string) =>
    user.click(screen.getByRole("button", { name }));

  const type = async (digits: string) => {
    for (const d of digits) {
      await press(d === "." ? "decimal point" : d);
    }
  };

  return { user, entry, expression, press, type };
};

describe("digit entry", () => {
  it("replaces the leading zero", async () => {
    const { entry, type } = setup();

    await type("7");

    expect(entry()).toBe("7");
  });

  it("appends subsequent digits", async () => {
    const { entry, type } = setup();

    await type("123");

    expect(entry()).toBe("123");
  });

  it("caps the entry at 15 characters", async () => {
    const { entry, type } = setup();

    await type("1234567890123456789");

    expect(entry()).toBe("123456789012345");
    expect(entry()!.length).toBe(15);
  });
});

describe("decimal point", () => {
  it("starts a fresh operand with a leading zero", async () => {
    const { entry, press } = setup();

    await press("decimal point");

    expect(entry()).toBe("0.");
  });

  it("appends to an existing operand", async () => {
    const { entry, type } = setup();

    await type("3.5");

    expect(entry()).toBe("3.5");
  });

  it("ignores a second decimal point in the same operand", async () => {
    const { entry, type } = setup();

    await type("3.5.7");

    expect(entry()).toBe("3.57");
  });

  it("allows a decimal on each side of an operator", async () => {
    const { entry, expression, press, type } = setup();

    await type("1.5");
    await press("plus");
    await type("2.5");

    expect(entry()).toBe("2.5");
    expect(expression()).toBe("1.5 + 2.5");
  });

  // A decimal after a result starts a new operand rather than extending it.
  it("starts a new operand when pressed after a result", async () => {
    calculateMock.mockResolvedValue(8);
    const { entry, expression, press, type } = setup();

    await type("5");
    await press("plus");
    await type("3");
    await press("equals");
    await waitFor(() => expect(entry()).toBe("8"));

    await press("decimal point");

    expect(entry()).toBe("0.");
    expect(expression()).toBe("");
  });

  it("latches a pending sign onto a decimal after a result", async () => {
    calculateMock.mockResolvedValue(8);
    const { entry, press, type } = setup();

    await type("5");
    await press("plus");
    await type("3");
    await press("equals");
    await waitFor(() => expect(entry()).toBe("8"));

    await press("decimal point");
    await type("25");

    expect(entry()).toBe("0.25");
  });
});

describe("sign handling", () => {
  it("toggles the sign of the current entry", async () => {
    const { entry, press, type } = setup();

    await type("5");
    await press("toggle sign");

    expect(entry()).toBe("-5");

    await press("toggle sign");
    expect(entry()).toBe("5");
  });

  it("leaves a bare zero unsigned", async () => {
    const { entry, press } = setup();

    await press("toggle sign");

    expect(entry()).toBe("0");
  });

  // Before the second operand is typed the display still shows the first one,
  // so the sign is latched rather than applied to the visible entry.
  it("latches a pending sign instead of negating the first operand", async () => {
    const { entry, expression, press, type } = setup();

    await type("5");
    await press("multiply");
    await press("toggle sign");

    expect(entry()).toBe("5");
    expect(expression()).toBe("5 × -");
  });

  it("applies a latched sign to the next digit typed", async () => {
    const { entry, expression, press, type } = setup();

    await type("5");
    await press("multiply");
    await press("toggle sign");
    await type("3");

    expect(entry()).toBe("-3");
    expect(expression()).toBe("5 × -3");
  });

  it("reads a minus after an operator as a sign, not a second operator", async () => {
    const { entry, expression, press, type } = setup();

    await type("5");
    await press("multiply");
    await press("minus");
    await type("3");

    expect(entry()).toBe("-3");
    expect(expression()).toBe("5 × -3");
    expect(calculateMock).not.toHaveBeenCalled();
  });

  it("toggles a latched sign off when pressed twice", async () => {
    const { expression, press, type } = setup();

    await type("5");
    await press("multiply");
    await press("minus");
    await press("minus");

    expect(expression()).toBe("5 ×");
  });

  it("latches a sign onto a decimal second operand", async () => {
    const { entry, press, type } = setup();

    await type("5");
    await press("multiply");
    await press("toggle sign");
    await press("decimal point");

    expect(entry()).toBe("-0.");
  });
});

describe("operator selection", () => {
  it("never sends a request on its own", async () => {
    const { press, type } = setup();

    await type("5");
    await press("plus");

    expect(calculateMock).not.toHaveBeenCalled();
  });

  it("shows the pending expression", async () => {
    const { expression, press, type } = setup();

    await type("5");
    await press("plus");

    expect(expression()).toBe("5 +");
  });

  it("replaces the pending operator rather than chaining", async () => {
    const { expression, press, type } = setup();

    await type("5");
    await press("plus");
    await press("multiply");

    expect(expression()).toBe("5 ×");
    expect(calculateMock).not.toHaveBeenCalled();
  });

  it("keeps an already typed second operand when the operator is swapped", async () => {
    const { entry, expression, press, type } = setup();

    await type("5");
    await press("plus");
    await type("3");
    await press("multiply");

    expect(entry()).toBe("3");
    expect(expression()).toBe("5 × 3");
  });
});

describe("equals", () => {
  it("sends the pending operation and shows the result", async () => {
    calculateMock.mockResolvedValue(8);
    const { entry, expression, press, type } = setup();

    await type("5");
    await press("plus");
    await type("3");
    await press("equals");

    await waitFor(() => expect(entry()).toBe("8"));
    expect(calculateMock).toHaveBeenCalledWith(5, 3, "+", expect.anything());
    expect(expression()).toBe("5 + 3 =");
  });

  it("does nothing when no operator is pending", async () => {
    const { press, type } = setup();

    await type("5");
    await press("equals");

    expect(calculateMock).not.toHaveBeenCalled();
  });

  it("sends a latched negative second operand", async () => {
    calculateMock.mockResolvedValue(-15);
    const { press, type } = setup();

    await type("5");
    await press("multiply");
    await press("toggle sign");
    await type("3");
    await press("equals");

    await waitFor(() =>
      expect(calculateMock).toHaveBeenCalledWith(5, -3, "×", expect.anything()),
    );
  });

  it("starts a new calculation when a digit is typed after a result", async () => {
    calculateMock.mockResolvedValue(8);
    const { entry, expression, press, type } = setup();

    await type("5");
    await press("plus");
    await type("3");
    await press("equals");
    await waitFor(() => expect(entry()).toBe("8"));

    await type("2");

    expect(entry()).toBe("2");
    expect(expression()).toBe("");
  });

  it("continues from the result when an operator follows it", async () => {
    calculateMock.mockResolvedValue(8);
    const { entry, expression, press, type } = setup();

    await type("5");
    await press("plus");
    await type("3");
    await press("equals");
    await waitFor(() => expect(entry()).toBe("8"));

    await press("multiply");

    expect(expression()).toBe("8 ×");
  });

  // Long results are abbreviated so they cannot overflow the display.
  it("abbreviates a result longer than the display allows", async () => {
    calculateMock.mockResolvedValue(0.30000000000000004);
    const { entry, press, type } = setup();

    await type("0.1");
    await press("plus");
    await type("0.2");
    await press("equals");

    await waitFor(() => expect(entry()).toBe("0.3000000000"));
  });
});

describe("square root", () => {
  it("applies to the current entry", async () => {
    calculateUnaryMock.mockResolvedValue(3);
    const { entry, expression, press, type } = setup();

    await type("9");
    await press("square root");

    await waitFor(() => expect(entry()).toBe("3"));
    expect(calculateUnaryMock).toHaveBeenCalledWith(9, "√", expect.anything());
    expect(expression()).toBe("√(9)");
  });

  it("completes the calculation when standalone", async () => {
    calculateUnaryMock.mockResolvedValue(3);
    const { entry, expression, press, type } = setup();

    await type("9");
    await press("square root");
    await waitFor(() => expect(entry()).toBe("3"));

    await type("5");

    expect(entry()).toBe("5");
    expect(expression()).toBe("");
  });

  // Mid-operation a root only replaces the second operand, so the pending
  // operation survives and can still be evaluated.
  it("replaces only the second operand mid-operation", async () => {
    calculateUnaryMock.mockResolvedValue(3);
    calculateMock.mockResolvedValue(13);
    const { entry, expression, press, type } = setup();

    await type("10");
    await press("plus");
    await type("9");
    await press("square root");

    await waitFor(() => expect(entry()).toBe("3"));
    expect(expression()).toBe("10 + √(9)");

    await press("equals");

    await waitFor(() =>
      expect(calculateMock).toHaveBeenCalledWith(10, 3, "+", expect.anything()),
    );
  });
});

describe("errors", () => {
  it("shows a friendly message when the operation is rejected", async () => {
    calculateMock.mockRejectedValue(new ApiError("cannot divide by zero"));
    const { press, type } = setup();

    await type("1");
    await press("divide");
    await type("0");
    await press("equals");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Can't divide by zero",
    );
  });

  it("falls back for an unrecognized failure", async () => {
    calculateMock.mockRejectedValue(new Error("boom"));
    const { press, type } = setup();

    await type("1");
    await press("plus");
    await type("2");
    await press("equals");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Try again.",
    );
  });

  // The operation is kept so the operand can be corrected and retried.
  it("keeps the pending operation after a failure", async () => {
    calculateMock.mockRejectedValueOnce(new ApiError("cannot divide by zero"));
    const { entry, press, type } = setup();

    await type("1");
    await press("divide");
    await type("0");
    await press("equals");
    await screen.findByRole("alert");

    calculateMock.mockResolvedValueOnce(0.5);
    await type("2");
    await press("equals");

    await waitFor(() => expect(entry()).toBe("0.5"));
    expect(calculateMock).toHaveBeenLastCalledWith(1, 2, "÷", expect.anything());
  });

  it("freezes the attempted expression after a failure", async () => {
    calculateMock.mockRejectedValue(new ApiError("cannot divide by zero"));
    const { expression, press, type } = setup();

    await type("1");
    await press("divide");
    await type("0");
    await press("equals");
    await screen.findByRole("alert");

    expect(expression()).toBe("1 ÷ 0");
  });

  it("clears the message once a new digit is typed", async () => {
    calculateMock.mockRejectedValue(new ApiError("cannot divide by zero"));
    const { press, type } = setup();

    await type("1");
    await press("divide");
    await type("0");
    await press("equals");
    await screen.findByRole("alert");

    await type("5");

    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });
});

describe("clear", () => {
  it("resets the display and the pending operation", async () => {
    const { entry, expression, press, type } = setup();

    await type("5");
    await press("plus");
    await type("3");
    await press("clear");

    expect(entry()).toBe("0");
    expect(expression()).toBe("");

    await press("equals");
    expect(calculateMock).not.toHaveBeenCalled();
  });

  it("clears an error message", async () => {
    calculateMock.mockRejectedValue(new ApiError("cannot divide by zero"));
    const { press, type } = setup();

    await type("1");
    await press("divide");
    await type("0");
    await press("equals");
    await screen.findByRole("alert");

    await press("clear");

    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });
});

describe("in-flight requests", () => {
  it("disables the keypad while a request is running", async () => {
    let resolve!: (value: number) => void;
    calculateMock.mockReturnValue(
      new Promise<number>((r) => {
        resolve = r;
      }),
    );
    const { entry, press, type } = setup();

    await type("5");
    await press("plus");
    await type("3");
    await press("equals");

    expect(screen.getByRole("button", { name: "equals" })).toBeDisabled();
    // Clear stays live so a stuck request can always be escaped.
    expect(screen.getByRole("button", { name: "clear" })).toBeEnabled();

    resolve(8);
    await waitFor(() => expect(entry()).toBe("8"));
  });

  // A superseded request must not surface an error or overwrite a newer result.
  it("ignores an aborted request", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    calculateUnaryMock.mockRejectedValue(abortError);
    const { entry, press, type } = setup();

    await type("9");
    await press("square root");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeEmptyDOMElement();
    });
    expect(entry()).toBe("9");
  });

  // The keypad is disabled while a request runs, so a superseded request is
  // reached via clear — which aborts it — and must not resolve over the state
  // that replaced it.
  it("discards a superseded result in favour of the newer state", async () => {
    const resolvers: Array<(value: number) => void> = [];
    calculateUnaryMock.mockImplementation(
      (_a, _op, signal) =>
        new Promise<number>((resolve, reject) => {
          resolvers.push(resolve);
          signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const { entry, press, type } = setup();

    await type("9");
    await press("square root");
    await press("clear");

    expect(entry()).toBe("0");

    // The superseded request resolving late must not overwrite the reset state.
    resolvers[0](3);
    await waitFor(() => expect(entry()).toBe("0"));
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });

  it("aborts a running request when cleared", async () => {
    let signal: AbortSignal | undefined;
    calculateMock.mockImplementation(
      (_a, _b, _op, s) =>
        new Promise<number>(() => {
          signal = s;
        }),
    );
    const { press, type } = setup();

    await type("5");
    await press("plus");
    await type("3");
    await press("equals");

    expect(signal!.aborted).toBe(false);

    await press("clear");

    expect(signal!.aborted).toBe(true);
  });
});
