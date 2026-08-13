package json

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
)

// Write encodes data into a buffer before touching the response, so an encoding
// failure can still be reported as a 500 instead of a 200 with an empty body.
func Write(w http.ResponseWriter, status int, data any) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(data); err != nil {
		slog.Error("failed to encode response", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error":"internal server error"}` + "\n"))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if _, err := w.Write(buf.Bytes()); err != nil {
		slog.Error("failed to write response", "error", err)
	}
}
