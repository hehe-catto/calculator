import { ApiError } from "./api";

const FRIENDLY_ERRORS: Record<string, string> = {
  "cannot divide by zero": "Can't divide by zero",
  "cannot calculate square root of a negative number":
    "No square root of a negative number",
  "cannot calculate percentage of zero": "Can't take a percentage of zero",
  "result is not a finite number": "That number is too big to show",
  "missing query parameters 'a' and 'b'": "Enter both numbers first",
  "invalid numeric values for 'a' or 'b'": "Those aren't valid numbers",
  "'a' and 'b' must be finite numbers": "Those numbers are out of range",
  "missing query parameter 'a'": "Enter a number first",
  "invalid numeric value for 'a'": "That isn't a valid number",
  "'a' must be a finite number": "That number is out of range",
  "Network error": "Can't reach the calculator",
  "Malformed response": "Unexpected reply from the server",
};

export const FALLBACK_ERROR = "Something went wrong. Try again.";

export function friendlyError(err: unknown): string {
  if (!(err instanceof ApiError)) return FALLBACK_ERROR;
  if (err.message.startsWith("Request failed (")) {
    return "Couldn't reach the calculator";
  }
  return FRIENDLY_ERRORS[err.message] ?? FALLBACK_ERROR;
}
