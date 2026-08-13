"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { calculate, calculateUnary, type BinaryOperator } from "@/lib/api";
import { friendlyError } from "@/lib/errors";

const MAX_ENTRY_LENGTH = 15;

const formatResult = (value: number) => {
  const text = String(value);
  return text.length > MAX_ENTRY_LENGTH ? value.toPrecision(10) : text;
};

const Page = () => {
  const [entry, setEntry] = useState("0");
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [pending, setPending] = useState<BinaryOperator | null>(null);
  const [freshOperand, setFreshOperand] = useState(true);
  const [operandNegative, setOperandNegative] = useState(false);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [completed, setCompleted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  // Supersedes any request still running, so rapid key presses cannot resolve
  // out of order and overwrite a newer result.
  const run = useCallback(async (task: (signal: AbortSignal) => Promise<number>) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await task(controller.signal);
      setEntry(formatResult(result));
      return result;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
      setError(friendlyError(err));
      return null;
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setLoading(false);
      }
    }
  }, []);

  const reset = () => {
    inFlight.current?.abort();
    inFlight.current = null;
    setEntry("0");
    setAccumulator(null);
    setPending(null);
    setFreshOperand(true);
    setOperandNegative(false);
    setJustEvaluated(false);
    setCompleted(null);
    setError(null);
    setLoading(false);
  };

  const inputDigit = (digit: string) => {
    setError(null);
    setCompleted(null);

    if (justEvaluated) {
      setEntry(digit);
      setAccumulator(null);
      setPending(null);
      setJustEvaluated(false);
      setOperandNegative(false);
      setFreshOperand(false);
      return;
    }

    if (operandNegative) {
      setEntry(`-${digit}`);
      setOperandNegative(false);
      setFreshOperand(false);
      return;
    }

    setEntry((prev) => {
      if (freshOperand || prev === "0") return digit;
      if (prev.length >= MAX_ENTRY_LENGTH) return prev;
      return prev + digit;
    });
    setFreshOperand(false);
  };

  const inputDecimal = () => {
    setError(null);
    setCompleted(null);

    if (justEvaluated) {
      setEntry("0.");
      setAccumulator(null);
      setPending(null);
      setJustEvaluated(false);
      setOperandNegative(false);
      setFreshOperand(false);
      return;
    }

    if (operandNegative) {
      setEntry("-0.");
      setOperandNegative(false);
      setFreshOperand(false);
      return;
    }

    setEntry((prev) => {
      if (freshOperand) return "0.";
      return prev.includes(".") ? prev : prev + ".";
    });
    setFreshOperand(false);
  };

  // Never fires a request, so only one operator is ever pending and an
  // operation never involves more than two numbers.
  const chooseOperator = (op: BinaryOperator) => {
    setError(null);
    setCompleted(null);

    // A minus before the second operand is a sign, not a second operator.
    if (op === "-" && pending !== null && freshOperand) {
      setOperandNegative((prev) => !prev);
      return;
    }

    if (pending !== null) {
      // freshOperand is left alone so an already-typed second operand survives
      // the swap.
      setPending(op);
      setOperandNegative(false);
      return;
    }

    setAccumulator(Number(entry));
    setPending(op);
    setFreshOperand(true);
    setOperandNegative(false);
    setJustEvaluated(false);
  };

  const toggleSign = () => {
    setError(null);

    // Before the second operand is started `entry` still shows the left one,
    // so the sign belongs on the latch rather than the displayed number.
    if (pending !== null && freshOperand) {
      setOperandNegative((prev) => !prev);
      return;
    }

    setEntry((prev) => {
      if (prev === "0") return prev;
      return prev.startsWith("-") ? prev.slice(1) : `-${prev}`;
    });
  };

  const applySqrt = async () => {
    const operand = entry;
    const prefix =
      pending !== null && accumulator !== null
        ? `${formatResult(accumulator)} ${pending} `
        : "";

    setCompleted(`${prefix}√(${operand})`);

    const result = await run((signal) => calculateUnary(Number(operand), "√", signal));
    if (result === null) return;

    setFreshOperand(true);
    // Only a standalone root completes a calculation; mid-operation it merely
    // replaces the second operand.
    setJustEvaluated(pending === null);
  };

  const equals = async () => {
    if (pending === null || accumulator === null) return;

    setError(null);

    const expression = `${formatResult(accumulator)} ${pending} ${entry}`;
    const result = await run((signal) =>
      calculate(accumulator, Number(entry), pending, signal),
    );

    if (result === null) {
      // Keep the operation intact so the operand can be corrected and retried.
      // The attempted expression is frozen because `freshOperand` would
      // otherwise render this as an operand that was never typed.
      setCompleted(expression);
      setFreshOperand(true);
      return;
    }

    setCompleted(`${expression} =`);
    setAccumulator(result);
    setPending(null);
    setFreshOperand(true);
    setOperandNegative(false);
    setJustEvaluated(true);
  };

  const digit = (value: string) => () => inputDigit(value);
  const operator = (op: BinaryOperator) => () => chooseOperator(op);

  const expression = (() => {
    if (completed !== null) return completed;
    if (pending === null) return "";
    const left = formatResult(accumulator ?? 0);
    if (operandNegative) return `${left} ${pending} -`;
    if (freshOperand) return `${left} ${pending}`;
    return `${left} ${pending} ${entry}`;
  })();

  return (
    <div className="calculator">
      <div className="display" aria-busy={loading}>
        <div className="display-expression">{expression || " "}</div>
        <div className="display-entry">{entry}</div>
      </div>

      <div className="error-region" role="alert">
        {error ? <span className="error-text">{error}</span> : null}
      </div>

      <div className="keys">
        <button type="button" className="key key-clear" onClick={reset} aria-label="clear">
          C
        </button>
        <button
          type="button"
          className="key key-op"
          onClick={toggleSign}
          disabled={loading}
          aria-label="toggle sign"
        >
          ±
        </button>
        <button
          type="button"
          className="key key-op"
          onClick={operator("%")}
          disabled={loading}
          aria-label="percentage of"
        >
          %
        </button>
        <button
          type="button"
          className="key key-op"
          onClick={operator("÷")}
          disabled={loading}
          aria-label="divide"
        >
          ÷
        </button>

        <button type="button" className="key key-digit" onClick={digit("7")} disabled={loading}>
          7
        </button>
        <button type="button" className="key key-digit" onClick={digit("8")} disabled={loading}>
          8
        </button>
        <button type="button" className="key key-digit" onClick={digit("9")} disabled={loading}>
          9
        </button>
        <button
          type="button"
          className="key key-op"
          onClick={operator("×")}
          disabled={loading}
          aria-label="multiply"
        >
          ×
        </button>

        <button type="button" className="key key-digit" onClick={digit("4")} disabled={loading}>
          4
        </button>
        <button type="button" className="key key-digit" onClick={digit("5")} disabled={loading}>
          5
        </button>
        <button type="button" className="key key-digit" onClick={digit("6")} disabled={loading}>
          6
        </button>
        <button
          type="button"
          className="key key-op"
          onClick={operator("-")}
          disabled={loading}
          aria-label="minus"
        >
          −
        </button>

        <button type="button" className="key key-digit" onClick={digit("1")} disabled={loading}>
          1
        </button>
        <button type="button" className="key key-digit" onClick={digit("2")} disabled={loading}>
          2
        </button>
        <button type="button" className="key key-digit" onClick={digit("3")} disabled={loading}>
          3
        </button>
        <button
          type="button"
          className="key key-op"
          onClick={operator("+")}
          disabled={loading}
          aria-label="plus"
        >
          +
        </button>

        <button
          type="button"
          className="key key-fn"
          onClick={() => void applySqrt()}
          disabled={loading}
          aria-label="square root"
        >
          √
        </button>
        <button
          type="button"
          className="key key-op"
          onClick={operator("^")}
          disabled={loading}
          aria-label="power"
        >
          ^
        </button>
        <button type="button" className="key key-digit" onClick={digit("0")} disabled={loading}>
          0
        </button>
        <button
          type="button"
          className="key key-digit"
          onClick={inputDecimal}
          disabled={loading}
          aria-label="decimal point"
        >
          .
        </button>

        <button
          type="button"
          className="key key-equals key-wide"
          onClick={() => void equals()}
          disabled={loading}
          aria-label="equals"
        >
          =
        </button>
      </div>
    </div>
  );
};

export default Page;
