"use client"
import { useState } from "react";
const Page = () => {
  const [input, setInput] = useState("");
  const handleClick = (value: string) => {
    setInput((prev) => prev + value);
  };
  const handleClear = () => {
    setInput("");
  };

  return (
    <div className="calculator">
      <div className="display">
        <div className="result">0</div>
      </div>

      <div className="keys">
        <button type="button" className="key">
          C
        </button>
        <button type="button" className="key">
          ±
        </button>
        <button type="button" className="key">
          %
        </button>
        <button type="button" className="key">
          ÷
        </button>

        <button type="button" className="key">
          7
        </button>
        <button type="button" className="key">
          8
        </button>
        <button type="button" className="key">
          9
        </button>
        <button type="button" className="key">
          ×
        </button>

        <button type="button" className="key">
          4
        </button>
        <button type="button" className="key">
          5
        </button>
        <button type="button" className="key">
          6
        </button>
        <button type="button" className="key">
          -
        </button>

        <button type="button" className="key">
          1
        </button>
        <button type="button" className="key">
          2
        </button>
        <button type="button" className="key">
          3
        </button>
        <button type="button" className="key">
          +
        </button>

        <button type="button" className="key key-wide">
          0
        </button>
        <button type="button" className="key">
          .
        </button>
        <button type="button" className="key">
          =
        </button>
      </div>
    </div>
  );
};

export default Page;
