package json

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWriteSuccess(t *testing.T) {
	rec := httptest.NewRecorder()

	Write(rec, http.StatusOK, map[string]float64{"result": 5})

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want %q", ct, "application/json")
	}
	if got, want := rec.Body.String(), "{\"result\":5}\n"; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}

func TestWritePreservesStatus(t *testing.T) {
	for _, status := range []int{http.StatusOK, http.StatusBadRequest, http.StatusInternalServerError} {
		rec := httptest.NewRecorder()

		Write(rec, status, map[string]string{"error": "nope"})

		if rec.Code != status {
			t.Errorf("status = %d, want %d", rec.Code, status)
		}
	}
}

// json.Encoder terminates each value with a newline; the fallback error body is
// written with one too, so both shapes stay consistent.
func TestWriteTerminatesBodyWithNewline(t *testing.T) {
	rec := httptest.NewRecorder()

	Write(rec, http.StatusOK, map[string]int{"a": 1})

	if !strings.HasSuffix(rec.Body.String(), "\n") {
		t.Errorf("body %q does not end with a newline", rec.Body.String())
	}
}

// Encoding into a buffer first means a failure can still be reported as a 500,
// rather than a 200 with an empty body.
func TestWriteEncodingFailure(t *testing.T) {
	tests := []struct {
		name string
		data any
	}{
		{"channel is not encodable", make(chan int)},
		{"function is not encodable", func() {}},
		{"marshaler returns an error", failingMarshaler{}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()

			Write(rec, http.StatusOK, tt.data)

			if rec.Code != http.StatusInternalServerError {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q, want %q", ct, "application/json")
			}

			want := "{\"error\":\"internal server error\"}\n"
			if got := rec.Body.String(); got != want {
				t.Errorf("body = %q, want %q", got, want)
			}

			// The fallback must still be valid JSON for the frontend to parse.
			var body map[string]string
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("fallback body is not valid JSON: %v", err)
			}
			if body["error"] != "internal server error" {
				t.Errorf("error = %q, want %q", body["error"], "internal server error")
			}
		})
	}
}

type failingMarshaler struct{}

func (failingMarshaler) MarshalJSON() ([]byte, error) {
	return nil, errors.New("marshal failed")
}

// A write failure is logged rather than promoted to a status change, since the
// header has already been sent by then.
func TestWriteToFailingWriter(t *testing.T) {
	w := &failingWriter{header: http.Header{}}

	Write(w, http.StatusOK, map[string]int{"result": 1})

	if w.status != http.StatusOK {
		t.Errorf("status = %d, want %d", w.status, http.StatusOK)
	}
}

type failingWriter struct {
	header http.Header
	status int
}

func (w *failingWriter) Header() http.Header { return w.header }

func (w *failingWriter) WriteHeader(status int) { w.status = status }

func (w *failingWriter) Write([]byte) (int, error) {
	return 0, errors.New("connection closed")
}
