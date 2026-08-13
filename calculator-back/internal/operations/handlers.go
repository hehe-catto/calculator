package operations

import (
	"context"
	"math"
	"net/http"
	"strconv"

	"github.com/hehe-catto/calculator/calculator-back/internal/operations/json"
)

type Service interface {
	Sum(ctx context.Context, a, b float64) (float64, error)
	Sub(ctx context.Context, a, b float64) (float64, error)
	Mul(ctx context.Context, a, b float64) (float64, error)
	Div(ctx context.Context, a, b float64) (float64, error)
	Sqrt(ctx context.Context, a float64) (float64, error)
	Exp(ctx context.Context, a, b float64) (float64, error)
	Per(ctx context.Context, a, b float64) (float64, error)
}

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{
		service: service,
	}
}

type CalcResponse struct {
	Result float64 `json:"result"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

type binaryOp func(ctx context.Context, a, b float64) (float64, error)

type unaryOp func(ctx context.Context, a float64) (float64, error)

// binary adapts a two-operand service method into an http.HandlerFunc. A service
// error means the operands were rejected (divide by zero, percentage of zero),
// so it maps to 400 rather than 500.
func (h *Handler) binary(op binaryOp) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, b, ok := h.parseInputs(w, r)
		if !ok {
			return
		}

		result, err := op(r.Context(), a, b)
		if err != nil {
			json.Write(w, http.StatusBadRequest, ErrorResponse{Error: err.Error()})
			return
		}

		writeResult(w, result)
	}
}

func (h *Handler) unary(op unaryOp) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, ok := h.parseInput(w, r)
		if !ok {
			return
		}

		result, err := op(r.Context(), a)
		if err != nil {
			json.Write(w, http.StatusBadRequest, ErrorResponse{Error: err.Error()})
			return
		}

		writeResult(w, result)
	}
}

func (h *Handler) SumOperation() http.HandlerFunc  { return h.binary(h.service.Sum) }
func (h *Handler) SubOperation() http.HandlerFunc  { return h.binary(h.service.Sub) }
func (h *Handler) MulOperation() http.HandlerFunc  { return h.binary(h.service.Mul) }
func (h *Handler) DivOperation() http.HandlerFunc  { return h.binary(h.service.Div) }
func (h *Handler) ExpOperation() http.HandlerFunc  { return h.binary(h.service.Exp) }
func (h *Handler) PerOperation() http.HandlerFunc  { return h.binary(h.service.Per) }
func (h *Handler) SqrtOperation() http.HandlerFunc { return h.unary(h.service.Sqrt) }

// writeResult rejects non-finite results, which arise from overflow on finite
// inputs (1e308 * 10). Encoding one would fail and yield an empty 200.
func writeResult(w http.ResponseWriter, result float64) {
	if math.IsNaN(result) || math.IsInf(result, 0) {
		json.Write(w, http.StatusBadRequest, ErrorResponse{Error: "result is not a finite number"})
		return
	}

	json.Write(w, http.StatusOK, CalcResponse{Result: result})
}

func (h *Handler) parseInputs(w http.ResponseWriter, r *http.Request) (float64, float64, bool) {
	aStr := r.URL.Query().Get("a")
	bStr := r.URL.Query().Get("b")

	if aStr == "" || bStr == "" {
		json.Write(w, http.StatusBadRequest, ErrorResponse{Error: "missing query parameters 'a' and 'b'"})
		return 0, 0, false
	}

	a, errA := strconv.ParseFloat(aStr, 64)
	b, errB := strconv.ParseFloat(bStr, 64)

	if errA != nil || errB != nil {
		json.Write(w, http.StatusBadRequest, ErrorResponse{Error: "invalid numeric values for 'a' or 'b'"})
		return 0, 0, false
	}

	// ParseFloat accepts "NaN" and "Inf" without error.
	if !isFinite(a) || !isFinite(b) {
		json.Write(w, http.StatusBadRequest, ErrorResponse{Error: "'a' and 'b' must be finite numbers"})
		return 0, 0, false
	}

	return a, b, true
}

func (h *Handler) parseInput(w http.ResponseWriter, r *http.Request) (float64, bool) {
	aStr := r.URL.Query().Get("a")

	if aStr == "" {
		json.Write(w, http.StatusBadRequest, ErrorResponse{Error: "missing query parameter 'a'"})
		return 0, false
	}

	a, err := strconv.ParseFloat(aStr, 64)
	if err != nil {
		json.Write(w, http.StatusBadRequest, ErrorResponse{Error: "invalid numeric value for 'a'"})
		return 0, false
	}

	if !isFinite(a) {
		json.Write(w, http.StatusBadRequest, ErrorResponse{Error: "'a' must be a finite number"})
		return 0, false
	}

	return a, true
}

func isFinite(f float64) bool {
	return !math.IsNaN(f) && !math.IsInf(f, 0)
}
