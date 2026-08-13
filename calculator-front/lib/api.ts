export type BinaryOperator = "+" | "-" | "×" | "÷" | "^" | "%";
export type UnaryOperator = "√";

const BINARY_ENDPOINTS: Record<BinaryOperator, string> = {
  "+": "sum",
  "-": "sub",
  "×": "mul",
  "÷": "div",
  "^": "exp",
  "%": "per",
};

const UNARY_ENDPOINTS: Record<UnaryOperator, string> = {
  "√": "sqrt",
};

export class ApiError extends Error {}

async function request(path: string, signal?: AbortSignal): Promise<number> {
  let res: Response;
  try {
    res = await fetch(path, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("Network error");
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      body && typeof body.error === "string"
        ? body.error
        : `Request failed (${res.status})`,
    );
  }

  if (!body || typeof body.result !== "number") {
    throw new ApiError("Malformed response");
  }

  return body.result;
}

export function calculate(
  a: number,
  b: number,
  op: BinaryOperator,
  signal?: AbortSignal,
): Promise<number> {
  const query = `a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`;
  return request(`/v1/operations/${BINARY_ENDPOINTS[op]}?${query}`, signal);
}

export function calculateUnary(
  a: number,
  op: UnaryOperator,
  signal?: AbortSignal,
): Promise<number> {
  const query = `a=${encodeURIComponent(a)}`;
  return request(`/v1/operations/${UNARY_ENDPOINTS[op]}?${query}`, signal);
}
