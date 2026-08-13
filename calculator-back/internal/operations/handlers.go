package operations

import (
	"context"
	"errors"
)

type CalcService struct{}

func NewService() *CalcService {
	return &CalcService{}
}

func (s *CalcService) Sum(ctx context.Context, a, b float64) (float64, error) {
	return a + b, nil
}

func (s *CalcService) Sub(ctx context.Context, a, b float64) (float64, error) {
	return a - b, nil
}

func (s *CalcService) Mul(ctx context.Context, a, b float64) (float64, error) {
	return a * b, nil
}

func (s *CalcService) Div(ctx context.Context, a, b float64) (float64, error) {
	if b == 0 {
		return 0, errors.New("cannot divide by zero")
	}
	return a / b, nil
}
