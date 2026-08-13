"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  calculate,
  calculateUnary,
  type BinaryOperator,
} from "@/lib/api";

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
  const [lastOp, setLastOp] = useState<{
    op: BinaryOperator;
    rhs: number;
  } | null>(null);
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
      setError(err instanceof ApiError ? err.message : "Something went wrong");
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
    setLastOp(null);
    setError(null);
    setLoading(false);
  };

  const inputDigit = (digit: string) => {
    setError(null);
    setEntry((prev) => {
      if (freshOperand || prev === "0") return digit;
      if (prev.length >= MAX_ENTRY_LENGTH) return prev;
      return prev + digit;
    });
    setFreshOperand(false);
  };

  const inputDecimal = () => {
    setError(null);
    setEntry((prev) => {
      if (freshOperand) return "0.";
      return prev.includes(".") ? prev : prev + ".";
    });
    setFreshOperand(false);
  };

  const toggleSign = () => {
    setError(null);
    setEntry((prev) => {
      if (prev === "0") return prev;
      return prev.startsWith("-") ? prev.slice(1) : `-${prev}`;
    });
  };

  const chooseOperator = async (op: BinaryOperator) => {
    setError(null);

    // Replacing the operator before a new operand is typed needs no call.
    if (pending !== null && freshOperand) {
      setPending(op);
      return;
    }

    let left = Number(entry);

    if (pending !== null && accumulator !== null) {
      const result = await run((signal) =>
        calculate(accumulator, Number(entry), pending, signal),
      );
      if (result === null) return;
      left = result;
    }

    setAccumulator(left);
    setPending(op);
    setFreshOperand(true);
    setLastOp(null);
  };

  const applySqrt = async () => {
    const result = await run((signal) => calculateUnary(Number(entry), "√", signal));
    if (result !== null) setFreshOperand(true);
  };

  const equals = async () => {
    setError(null);

    if (pending !== null && accumulator !== null) {
      const rhs = Number(entry);
      const result = await run((signal) =>
        calculate(accumulator, rhs, pending, signal),
      );
      if (result === null) return;

      setLastOp({ op: pending, rhs });
      setAccumulator(result);
      setPending(null);
      setFreshOperand(true);
      return;
    }

    // Repeated equals replays the last operation against the running result.
    if (lastOp !== null) {
      const result = await run((signal) =>
        calculate(Number(entry), lastOp.rhs, lastOp.op, signal),
      );
      if (result === null) return;
      setAccumulator(result);
      setFreshOperand(true);
    }
  };

  const digit = (value: string) => () => inputDigit(value);
  const operator = (op: BinaryOperator) => () => {
    void chooseOperator(op);
  };

  const displayText = error ?? entry;
  const displayClass = ["result", error && "is-error", loading && "is-loading"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="calculator">
      <div className="display">
        <div className={displayClass} role={error ? "alert" : undefined} aria-busy={loading}>
          {displayText}
        </div>
      </div>

      <div className="keys">
        <button type="button" className="key" onClick={reset}>
          C
        </button>
        <button type="button" className="key" onClick={toggleSign} disabled={loading}>
          ±
        </button>
        <button type="button" className="key" onClick={operator("%")} disabled={loading}>
          %
        </button>
        <button type="button" className="key" onClick={operator("÷")} disabled={loading}>
          ÷
        </button>

        <button type="button" className="key" onClick={digit("7")} disabled={loading}>
          7
        </button>
        <button type="button" className="key" onClick={digit("8")} disabled={loading}>
          8
        </button>
        <button type="button" className="key" onClick={digit("9")} disabled={loading}>
          9
        </button>
        <button type="button" className="key" onClick={operator("×")} disabled={loading}>
          ×
        </button>

        <button type="button" className="key" onClick={digit("4")} disabled={loading}>
          4
        </button>
        <button type="button" className="key" onClick={digit("5")} disabled={loading}>
          5
        </button>
        <button type="button" className="key" onClick={digit("6")} disabled={loading}>
          6
        </button>
        <button type="button" className="key" onClick={operator("-")} disabled={loading}>
          -
        </button>

        <button type="button" className="key" onClick={digit("1")} disabled={loading}>
          1
        </button>
        <button type="button" className="key" onClick={digit("2")} disabled={loading}>
          2
        </button>
        <button type="button" className="key" onClick={digit("3")} disabled={loading}>
          3
        </button>
        <button type="button" className="key" onClick={operator("+")} disabled={loading}>
          +
        </button>

        <button
          type="button"
          className="key"
          onClick={() => void applySqrt()}
          disabled={loading}
        >
          √
        </button>
        <button type="button" className="key" onClick={operator("^")} disabled={loading}>
          ^
        </button>
        <button type="button" className="key" onClick={digit("0")} disabled={loading}>
          0
        </button>
        <button type="button" className="key" onClick={inputDecimal} disabled={loading}>
          .
        </button>

        <button
          type="button"
          className="key key-wide"
          onClick={() => void equals()}
          disabled={loading}
        >
          =
        </button>
      </div>
    </div>
  );
};

export default Page;
