ARG GO_VERSION=1.26

FROM golang:${GO_VERSION} AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/app ./cmd


FROM gcr.io/distroless/static-debian12:nonroot AS runner

COPY --from=builder /out/app /app

EXPOSE 8080
USER nonroot:nonroot

ENTRYPOINT ["/app"]
