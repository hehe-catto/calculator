package operations

import (
	"context"
	"net/http"
	"strconv"

	"github.com/hehe-catto/calculator/calculator-back/internal/operations/json"
)

type Service interface {
	Sum(ctx context.Context, a, b float64) (float64, error)
	Sub(ctx context.Context, a, b float64) (float64, error)
	Mul(ctx context.Context, a, b float64) (float64, error)
	Div(ctx context.Context, a, b float64) (float64, error)
}

type handler struct {
	service Service
}

func NewHandler(service Service) *handler {
	return &handler{
		service: service,
	}
}

type CalcResponse struct {
	Result float64 `json:"result"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func (h *handler) SumOperation(w http.ResponseWriter, r *http.Request) {
	a, b, ok := h.parseInputs(w, r)
	if !ok {
		return
	}

	result, err := h.service.Sum(r.Context(), a, b)
	if err != nil {
		json.Write(w, http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	json.Write(w, http.StatusOK, CalcResponse{Result: result})
}

func (h *handler) SubOperation(w http.ResponseWriter, r *http.Request) {
	a, b, ok := h.parseInputs(w, r)
	if !ok {
		return
	}

	result, err := h.service.Sub(r.Context(), a, b)
	if err != nil {
		json.Write(w, http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	json.Write(w, http.StatusOK, CalcResponse{Result: result})
}

func (h *handler) MulOperation(w http.ResponseWriter, r *http.Request) {
	a, b, ok := h.parseInputs(w, r)
	if !ok {
		return
	}

	result, err := h.service.Mul(r.Context(), a, b)
	if err != nil {
		json.Write(w, http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	json.Write(w, http.StatusOK, CalcResponse{Result: result})
}

func (h *handler) DivOperation(w http.ResponseWriter, r *http.Request) {
	a, b, ok := h.parseInputs(w, r)
	if !ok {
		return
	}

	result, err := h.service.Div(r.Context(), a, b)
	if err != nil {
		json.Write(w, http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	json.Write(w, http.StatusOK, CalcResponse{Result: result})
}

func (h *handler) parseInputs(w http.ResponseWriter, r *http.Request) (float64, float64, bool) {
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

	return a, b, true
}
