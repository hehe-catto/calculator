package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNormalizePort(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"empty falls back to the default", "", ":8080"},
		{"bare port gains a colon", "8080", ":8080"},
		{"prefixed port is unchanged", ":8080", ":8080"},
		{"non default bare port", "3000", ":3000"},
		{"non default prefixed port", ":3000", ":3000"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizePort(tt.in); got != tt.want {
				t.Errorf("normalizePort(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	app := application{config: config{addr: normalizePort("")}}
	return app.mount()
}

func get(t *testing.T, h http.Handler, target string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, target, nil))
	return rec
}

// Operands are chosen so every operation yields a different result, which
// catches a route wired to the wrong handler.
func TestOperationRoutesAreWiredCorrectly(t *testing.T) {
	h := newTestServer(t)

	tests := []struct {
		path string
		want float64
	}{
		{"/v1/operations/sum?a=8&b=2", 10},
		{"/v1/operations/sub?a=8&b=2", 6},
		{"/v1/operations/mul?a=8&b=2", 16},
		{"/v1/operations/div?a=8&b=2", 4},
		{"/v1/operations/exp?a=8&b=2", 64},
		{"/v1/operations/per?a=8&b=2", 400},
		{"/v1/operations/sqrt?a=9", 3},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			rec := get(t, h, tt.path)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d (body: %s)", rec.Code, http.StatusOK, rec.Body.String())
			}

			var body struct {
				Result float64 `json:"result"`
			}
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("failed to decode body: %v", err)
			}
			if body.Result != tt.want {
				t.Errorf("result = %v, want %v", body.Result, tt.want)
			}
		})
	}
}

func TestOperationRoutesRejectInvalidInput(t *testing.T) {
	h := newTestServer(t)

	rec := get(t, h, "/v1/operations/div?a=1&b=0")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}

	var body struct {
		Error string `json:"error"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode body: %v", err)
	}
	if body.Error != "cannot divide by zero" {
		t.Errorf("error = %q, want %q", body.Error, "cannot divide by zero")
	}
}

func TestHealthRoute(t *testing.T) {
	h := newTestServer(t)

	rec := get(t, h, "/health")

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if got := rec.Body.String(); got != "hello" {
		t.Errorf("body = %q, want %q", got, "hello")
	}
}

// The operations are registered as GET only, so other verbs must not reach a
// handler.
func TestOperationRoutesRejectNonGetMethods(t *testing.T) {
	h := newTestServer(t)

	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch} {
		t.Run(method, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(method, "/v1/operations/sum?a=1&b=2", nil))

			if rec.Code != http.StatusMethodNotAllowed {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusMethodNotAllowed)
			}
		})
	}
}

func TestUnknownRoutesReturnNotFound(t *testing.T) {
	h := newTestServer(t)

	for _, path := range []string{"/", "/v1/operations", "/v1/operations/modulo", "/v1/unknown"} {
		t.Run(path, func(t *testing.T) {
			rec := get(t, h, path)

			if rec.Code != http.StatusNotFound {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
			}
		})
	}
}
