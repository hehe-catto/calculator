package operations

import (
	"context"
	"errors"
	"math"
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

func (s *CalcService) Sqrt(ctx context.Context, a float64) (float64, error) {
	if a < 0 {
		return 0, errors.New("cannot calculate square root of a negative number")
	}
	return math.Sqrt(a), nil
}

func (s *CalcService) Exp(ctx context.Context, a, b float64) (float64, error) {
	return math.Pow(a, b), nil
}

func (s *CalcService) Per(ctx context.Context, a, b float64) (float64, error) {
	if b == 0 {
		return 0, errors.New("cannot calculate percentage of zero")
	}
	return a / b * 100, nil
}
