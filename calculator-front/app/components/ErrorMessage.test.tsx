import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorMessage } from "./ErrorMessage";

describe("ErrorMessage", () => {
  it("shows the message", () => {
    render(<ErrorMessage message="Can't divide by zero" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Can't divide by zero");
  });

  // The region is always present so the live region is stable and the keypad
  // does not shift when a message appears.
  it("renders an empty live region when there is no message", () => {
    render(<ErrorMessage message={null} />);

    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });
});
