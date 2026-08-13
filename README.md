# calculator

A calculator UI (Next.js static export) served by nginx, with arithmetic performed
by a Go API. nginx proxies `/v1/*` to the backend, so the browser talks to a single
origin and no CORS configuration is needed.

## Running with Docker

```bash
docker compose up --build
```

Open http://localhost:3000. The backend is not published to the host — it is
reachable only through the frontend proxy.

## Running locally

```bash
cd calculator-back && PORT=8080 go run ./cmd    # terminal 1
cd calculator-front && npm run dev              # terminal 2
```

`next dev` proxies `/v1` to `localhost:8080` via a rewrite in `next.config.mjs`, so
the same relative URLs work in development and production. `next build` prints a
warning that rewrites are not applied when exporting — that is expected, since nginx
handles the proxying in production.

## API

All endpoints are `GET` under `/v1/operations` and return `{"result": <number>}`, or
`{"error": "<message>"}` with a 4xx status.

| Endpoint | Params | Example |
| --- | --- | --- |
| `/sum` `/sub` `/mul` `/div` | `a`, `b` | `/v1/operations/sum?a=2&b=3` → `5` |
| `/exp` | `a`, `b` | `a` to the power of `b` |
| `/per` | `a`, `b` | what percent `a` is of `b` |
| `/sqrt` | `a` | `/v1/operations/sqrt?a=9` → `3` |



# Promps used
Model: claude-opus, effort high
Context: In this folder we have two repositories: calculator-front (React App with just the skeleton of a calculator) and calculator-back (Go backend, with get endpoints for sum, sub, div and mult). Also each repository run in its own container. 
Write me a plan to connect the backend with the frontend, prioritizing making it a clean way.


Update the UI of the calculator with the following requirements:
- Add a hover property to the buttons
- Prioritize a simple clean design, with hints of retro
- Show the error in operations a user-friendly way
- Do not let the user type two consecutive operations (only allow the minus for negative numbers)
- Basic approach will only support two number operations, not chained operations
- Do not use tailwind, only css

