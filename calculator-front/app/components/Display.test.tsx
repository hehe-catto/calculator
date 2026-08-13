import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Display } from "./Display";

const setup = (props: Parameters<typeof Display>[0]) => {
  const { container } = render(<Display {...props} />);
  return {
    root: container.querySelector(".display")!,
    expression: container.querySelector(".display-expression")!,
    entry: container.querySelector(".display-entry")!,
  };
};

describe("Display", () => {
  it("renders the expression and the entry", () => {
    const { expression, entry } = setup({
      expression: "5 + 3",
      entry: "3",
      loading: false,
    });

    expect(expression).toHaveTextContent("5 + 3");
    expect(entry).toHaveTextContent("3");
  });

  // A non-breaking space keeps the row's height stable when there is no
  // expression, so the keypad below does not shift.
  it("keeps the expression row occupied when empty", () => {
    const { expression } = setup({ expression: "", entry: "0", loading: false });

    expect(expression.textContent).toBe(" ");
  });

  it("reflects the loading state for assistive technology", () => {
    const { root } = setup({ expression: "", entry: "0", loading: true });

    expect(root).toHaveAttribute("aria-busy", "true");
  });

  it("is not busy when idle", () => {
    const { root } = setup({ expression: "", entry: "0", loading: false });

    expect(root).toHaveAttribute("aria-busy", "false");
  });
});
