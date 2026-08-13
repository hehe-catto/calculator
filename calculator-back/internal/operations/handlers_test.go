package operations

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"
)

// stubService lets handler behaviour be tested independently of the real math,
// so error mapping can be verified for operations that never fail on their own.
type stubService struct {
	result float64
	err    error
}

func (s stubService) Sum(ctx context.Context, a, b float64) (float64, error) {
	return s.result, s.err
}
func (s stubService) Sub(ctx context.Context, a, b float64) (float64, error) {
	return s.result, s.err
}
func (s stubService) Mul(ctx context.Context, a, b float64) (float64, error) {
	return s.result, s.err
}
func (s stubService) Div(ctx context.Context, a, b float64) (float64, error) {
	return s.result, s.err
}
func (s stubService) Sqrt(ctx context.Context, a float64) (float64, error) {
	return s.result, s.err
}
func (s stubService) Exp(ctx context.Context, a, b float64) (float64, error) {
	return s.result, s.err
}
func (s stubService) Per(ctx context.Context, a, b float64) (float64, error) {
	return s.result, s.err
}

func call(t *testing.T, h http.HandlerFunc, target string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, target, nil))
	return rec
}

func decodeResult(t *testing.T, rec *httptest.ResponseRecorder) float64 {
	t.Helper()
	var body CalcResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode success body %q: %v", rec.Body.String(), err)
	}
	return body.Result
}

func decodeError(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode error body %q: %v", rec.Body.String(), err)
	}
	return body.Error
}

func assertStatus(t *testing.T, rec *httptest.ResponseRecorder, want int) {
	t.Helper()
	if rec.Code != want {
		t.Errorf("status = %d, want %d (body: %s)", rec.Code, want, rec.Body.String())
	}
}

func TestBinaryHandlerSuccess(t *testing.T) {
	h := NewHandler(NewService())

	tests := []struct {
		name    string
		handler http.HandlerFunc
		query   string
		want    float64
	}{
		{"sum", h.SumOperation(), "a=2&b=3", 5},
		{"sub", h.SubOperation(), "a=5&b=3", 2},
		{"mul", h.MulOperation(), "a=4&b=3", 12},
		{"div", h.DivOperation(), "a=6&b=3", 2},
		{"exp", h.ExpOperation(), "a=2&b=3", 8},
		{"per", h.PerOperation(), "a=5&b=10", 50},
		{"negative operands", h.SumOperation(), "a=-2&b=-3", -5},
		{"float operands", h.SumOperation(), "a=0.5&b=0.25", 0.75},
		{"exponent notation", h.SumOperation(), "a=1e2&b=0", 100},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := call(t, tt.handler, "/?"+tt.query)

			assertStatus(t, rec, http.StatusOK)
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q, want %q", ct, "application/json")
			}
			if got := decodeResult(t, rec); got != tt.want {
				t.Errorf("result = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUnaryHandlerSuccess(t *testing.T) {
	h := NewHandler(NewService())

	rec := call(t, h.SqrtOperation(), "/?a=9")

	assertStatus(t, rec, http.StatusOK)
	if got := decodeResult(t, rec); got != 3 {
		t.Errorf("result = %v, want 3", got)
	}
}

// A unary handler must not require 'b'; supplying it changes nothing.
func TestUnaryHandlerIgnoresSecondParam(t *testing.T) {
	h := NewHandler(NewService())

	rec := call(t, h.SqrtOperation(), "/?a=9&b=100")

	assertStatus(t, rec, http.StatusOK)
	if got := decodeResult(t, rec); got != 3 {
		t.Errorf("result = %v, want 3", got)
	}
}

func TestBinaryHandlerInvalidInput(t *testing.T) {
	h := NewHandler(NewService())

	tests := []struct {
		name  string
		query string
		want  string
	}{
		{"both missing", "", "missing query parameters 'a' and 'b'"},
		{"b missing", "a=2", "missing query parameters 'a' and 'b'"},
		{"a missing", "b=2", "missing query parameters 'a' and 'b'"},
		{"a empty", "a=&b=2", "missing query parameters 'a' and 'b'"},
		{"b empty", "a=2&b=", "missing query parameters 'a' and 'b'"},
		{"a unparseable", "a=abc&b=2", "invalid numeric values for 'a' or 'b'"},
		{"b unparseable", "a=2&b=abc", "invalid numeric values for 'a' or 'b'"},
		{"both unparseable", "a=x&b=y", "invalid numeric values for 'a' or 'b'"},
		// ParseFloat accepts these spellings, so only the explicit finite check
		// rejects them.
		{"a is NaN", "a=NaN&b=2", "'a' and 'b' must be finite numbers"},
		{"b is NaN", "a=2&b=NaN", "'a' and 'b' must be finite numbers"},
		{"a is Inf", "a=Inf&b=2", "'a' and 'b' must be finite numbers"},
		{"a is +Inf", "a=%2BInf&b=2", "'a' and 'b' must be finite numbers"},
		{"a is -Inf", "a=-Inf&b=2", "'a' and 'b' must be finite numbers"},
		{"a is infinity spelled out", "a=infinity&b=2", "'a' and 'b' must be finite numbers"},
		{"b is Inf", "a=2&b=Inf", "'a' and 'b' must be finite numbers"},
		// ParseFloat is case-insensitive for these.
		{"a is lowercase nan", "a=nan&b=2", "'a' and 'b' must be finite numbers"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := call(t, h.SumOperation(), "/?"+tt.query)

			assertStatus(t, rec, http.StatusBadRequest)
			if got := decodeError(t, rec); got != tt.want {
				t.Errorf("error = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestUnaryHandlerInvalidInput(t *testing.T) {
	h := NewHandler(NewService())

	tests := []struct {
		name  string
		query string
		want  string
	}{
		{"missing", "", "missing query parameter 'a'"},
		{"empty", "a=", "missing query parameter 'a'"},
		{"unparseable", "a=abc", "invalid numeric value for 'a'"},
		{"NaN", "a=NaN", "'a' must be a finite number"},
		{"Inf", "a=Inf", "'a' must be a finite number"},
		{"negative Inf", "a=-Inf", "'a' must be a finite number"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := call(t, h.SqrtOperation(), "/?"+tt.query)

			assertStatus(t, rec, http.StatusBadRequest)
			if got := decodeError(t, rec); got != tt.want {
				t.Errorf("error = %q, want %q", got, tt.want)
			}
		})
	}
}

// Rejected operands are a client problem, so service errors must surface as 400
// rather than 500.
func TestServiceErrorsMapToBadRequest(t *testing.T) {
	h := NewHandler(NewService())

	tests := []struct {
		name    string
		handler http.HandlerFunc
		query   string
		want    string
	}{
		{"divide by zero", h.DivOperation(), "a=1&b=0", "cannot divide by zero"},
		{"percentage of zero", h.PerOperation(), "a=5&b=0", "cannot calculate percentage of zero"},
		{"negative square root", h.SqrtOperation(), "a=-1", "cannot calculate square root of a negative number"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := call(t, tt.handler, "/?"+tt.query)

			assertStatus(t, rec, http.StatusBadRequest)
			if got := decodeError(t, rec); got != tt.want {
				t.Errorf("error = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestArbitraryServiceErrorMapsToBadRequest(t *testing.T) {
	h := NewHandler(stubService{err: errors.New("boom")})

	t.Run("binary", func(t *testing.T) {
		rec := call(t, h.SumOperation(), "/?a=1&b=2")

		assertStatus(t, rec, http.StatusBadRequest)
		if got := decodeError(t, rec); got != "boom" {
			t.Errorf("error = %q, want %q", got, "boom")
		}
	})

	t.Run("unary", func(t *testing.T) {
		rec := call(t, h.SqrtOperation(), "/?a=1")

		assertStatus(t, rec, http.StatusBadRequest)
		if got := decodeError(t, rec); got != "boom" {
			t.Errorf("error = %q, want %q", got, "boom")
		}
	})
}

// Encoding a non-finite float fails, which would otherwise yield an empty 200.
func TestNonFiniteResultsRejected(t *testing.T) {
	t.Run("real overflow from finite operands", func(t *testing.T) {
		h := NewHandler(NewService())

		tests := []struct {
			name    string
			handler http.HandlerFunc
			query   string
		}{
			{"exp overflow", h.ExpOperation(), "a=1e308&b=2"},
			{"mul overflow", h.MulOperation(), "a=1e308&b=10"},
			{"sum overflow", h.SumOperation(), "a=1.7976931348623157e308&b=1.7976931348623157e308"},
			{"exp NaN", h.ExpOperation(), "a=-8&b=0.5"},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				rec := call(t, tt.handler, "/?"+tt.query)

				assertStatus(t, rec, http.StatusBadRequest)
				if got := decodeError(t, rec); got != "result is not a finite number" {
					t.Errorf("error = %q, want %q", got, "result is not a finite number")
				}
			})
		}
	})

	t.Run("stubbed non finite results", func(t *testing.T) {
		for _, result := range []float64{math.NaN(), math.Inf(1), math.Inf(-1)} {
			h := NewHandler(stubService{result: result})

			rec := call(t, h.SumOperation(), "/?a=1&b=2")

			assertStatus(t, rec, http.StatusBadRequest)
			if got := decodeError(t, rec); got != "result is not a finite number" {
				t.Errorf("result %v: error = %q, want %q", result, got, "result is not a finite number")
			}
		}
	})
}

// Underflow stays finite (subnormal, or 0 once it underflows completely), so
// unlike overflow it remains a successful response.
func TestUnderflowIsSuccessful(t *testing.T) {
	h := NewHandler(NewService())

	tests := []struct {
		name  string
		query string
		want  float64
	}{
		{"subnormal", "a=1e-308&b=1e10", 1e-318},
		{"underflows to zero", "a=1e-308&b=1e300", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := call(t, h.DivOperation(), "/?"+tt.query)

			assertStatus(t, rec, http.StatusOK)
			if got := decodeResult(t, rec); got != tt.want {
				t.Errorf("result = %v, want %v", got, tt.want)
			}
		})
	}
}
