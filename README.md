# calculator

A calculator UI (Next.js static export) served by nginx, with arithmetic performed
by a Go API. nginx proxies `/v1/*` to the backend, so the browser talks to a single
origin and no CORS configuration is needed.

## Requirements

| Setup | Needs |
| --- | --- |
| Docker | Docker with Compose v2 |
| Local | Go 1.26+ and Node 24+ |

## Running with Docker

```bash
docker compose up --build
```

Open http://localhost:3000. The backend is not published to the host — it is
reachable only through the frontend proxy.

## Running locally

```bash
cd calculator-back && PORT=8080 go run ./cmd            # terminal 1
cd calculator-front && npm install && npm run dev       # terminal 2
```

Open http://localhost:3000.

`next dev` proxies `/v1` to `localhost:8080` via a rewrite in `next.config.mjs`, so
the same relative URLs work in development and production. `next build` prints a
warning that rewrites are not applied when exporting — that is expected, since nginx
handles the proxying in production.

## Testing

Both layers have unit tests: the backend with `go test`, the frontend with Vitest
and React Testing Library. Run `npm install` in `calculator-front` first.

| Layer | Test | Coverage |
| --- | --- | --- |
| `calculator-back` | `go test ./...` | `go test ./... -coverprofile=coverage.out && go tool cover -html=coverage.out` |
| `calculator-front` | `npm test` | `npm run test:coverage` |

Coverage prints a summary to the terminal and writes a browsable report to
`calculator-back/coverage.html` and `calculator-front/coverage/index.html`. Both are
gitignored.

The tests focus on the edges: dividing by zero, the square root of a negative, a
percentage of zero, operands that parse as `NaN` or `Inf`, and results that overflow
to infinity. On the frontend they also cover the operator-to-endpoint mapping, the
translation of backend messages into friendly text, and the state machine — sign
latching, operator swapping, and superseded in-flight requests.

`main()` and `run()` are the only uncovered backend functions; both bind a real
socket and are left to the `/health` check instead.

## API

All endpoints are `GET` under `/v1/operations`. A success returns `200` with
`{"result": <number>}`; a rejected request returns `400` with `{"error": "<message>"}`.

| Endpoint | Params | Meaning |
| --- | --- | --- |
| `/sum` `/sub` `/mul` `/div` | `a`, `b` | arithmetic |
| `/exp` | `a`, `b` | `a` to the power of `b` |
| `/per` | `a`, `b` | what percent `a` is of `b` |
| `/sqrt` | `a` | square root |

`GET /health` returns `hello` and is used to check the service is up.

Operands must be finite numbers. Requests are rejected when a parameter is missing
or unparseable, when an operation is undefined (dividing by zero, the square root of
a negative number, a percentage of zero), or when the result overflows to infinity.

### Examples

```bash
curl "localhost:3000/v1/operations/sum?a=2&b=3"
# {"result":5}

curl "localhost:3000/v1/operations/sqrt?a=9"
# {"result":3}

curl "localhost:3000/v1/operations/div?a=1&b=0"
# 400 {"error":"cannot divide by zero"}

curl "localhost:3000/v1/operations/sum?a=2"
# 400 {"error":"missing query parameters 'a' and 'b'"}
```

The UI never shows these raw messages: `lib/errors.ts` maps each one to friendly
text, so `cannot divide by zero` reaches the user as "Can't divide by zero".

## Design decisions

We will be using dependency injection, it makes the code easier to test. The
`Service` interface in `internal/operations/handlers.go` is what makes this concrete:
the handler tests inject a stub through it to check how errors and non-finite
results are mapped to responses, without depending on the real arithmetic.

### Architecture

The project has a Clean Architecture, with the following layers:

- Transport (HTTP): decoupled routing. The input validation is integrated in the
  handlers. Manages HTTP status codes and serialization of JSON responses.
- Service (Business logic): Go domain logic, it executes the operations of the
  calculator and its related validation.

### File roles

- **calculator-back/cmd/main.go**: its responsibility is to compose dependencies
  (services, handlers) and call the program: start the application.
- **calculator-back/cmd/api.go**: mounts and runs the app, injects middleware.
- **calculator-back/internal/operations**: contains core domain logic.

### Frontend

The app is a static export served by nginx, which also proxies `/v1`. One relative
URL therefore works in both development and production, so no API base URL has to be
baked in at build time.

API access is isolated in `lib/api.ts`, which owns the operator-to-endpoint mapping
and supersedes in-flight requests so fast key presses cannot resolve out of order.
`lib/errors.ts` translates backend messages into user-facing text.

Operations take two numbers. Pressing an operator only latches it — no request is
sent until `=`, so a second operator replaces the pending one instead of chaining,
and a minus typed before the second operand is read as a sign.

## References

1. Go Docker image
   https://hub.docker.com/_/golang
2. Architecture
   https://youtu.be/s3XItrqfccw?si=Ze_2e7fMptIiZqDV
3. Dockerfile for the frontend
   https://docs.docker.com/guides/reactjs/

<details>
<summary>Prompts used</summary>

Model: claude-opus, effort high. Written in plan mode: each prompt below produced a
plan that was reviewed and approved before any code was written.

Context: In this folder we have two repositories: calculator-front (React App with just the skeleton of a calculator) and calculator-back (Go backend, with get endpoints for sum, sub, div and mult). Also each repository run in its own container.
Write me a plan to connect the backend with the frontend, prioritizing making it a clean way.

Update the UI of the calculator with the following requirements:
- Add a hover property to the buttons
- Prioritize a simple clean design, with hints of retro
- Show the error in operations a user-friendly way
- Do not let the user type two consecutive operations (only allow the minus for negative numbers)
- Basic approach will only support two number operations, not chained operations
- Do not use tailwind, only css

Update the actual documentation, in the backend and frontend app there is information about design decsions, keep those sections with the same content. Just polish it.
Consider, in the frontend and backend repository this:
- Just having one readme in the base of the project
- make clear the setup for running this project, also the requirements if needed
- explain the api usage
- add api examples
- there are some references, include those as well
- considet the prompts too
Everything must be clean and concise, no extra no needed-info. Easy to read.

Add unit tests and a coverage report for both layers.
- Cover the key functionality of the Go backend and the Next.js frontend
- Prioritize edge cases: divide by zero, square root of a negative, percentage of
  zero, non-finite operands (NaN/Inf), and results that overflow to infinity
- On the frontend, cover the operator-to-endpoint mapping, the backend-to-friendly
  error translation, and the calculator state machine (sign latching, operator
  swapping, superseded in-flight requests)
- Report coverage in the terminal and as a browsable HTML report
- Document how to run the tests in the README

</details>
