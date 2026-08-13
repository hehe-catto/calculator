package operations

import (
	"context"
	"math"
	"testing"
)

func TestSum(t *testing.T) {
	s := NewService()

	tests := []struct {
		name string
		a, b float64
		want float64
	}{
		{"positives", 2, 3, 5},
		{"negatives", -2, -3, -5},
		{"mixed signs", -2, 3, 1},
		{"zeros", 0, 0, 0},
		{"floats", 0.5, 0.25, 0.75},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := s.Sum(context.Background(), tt.a, tt.b)
			if err != nil {
				t.Fatalf("Sum(%v, %v) returned unexpected error: %v", tt.a, tt.b, err)
			}
			if got != tt.want {
				t.Errorf("Sum(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestSub(t *testing.T) {
	s := NewService()

	tests := []struct {
		name string
		a, b float64
		want float64
	}{
		{"positives", 5, 3, 2},
		{"result negative", 3, 5, -2},
		{"double negative", -3, -5, 2},
		{"zeros", 0, 0, 0},
		{"floats", 0.75, 0.25, 0.5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := s.Sub(context.Background(), tt.a, tt.b)
			if err != nil {
				t.Fatalf("Sub(%v, %v) returned unexpected error: %v", tt.a, tt.b, err)
			}
			if got != tt.want {
				t.Errorf("Sub(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestMul(t *testing.T) {
	s := NewService()

	tests := []struct {
		name string
		a, b float64
		want float64
	}{
		{"positives", 4, 3, 12},
		{"by zero", 4, 0, 0},
		{"negative times positive", -4, 3, -12},
		{"negative times negative", -4, -3, 12},
		{"floats", 0.5, 0.5, 0.25},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := s.Mul(context.Background(), tt.a, tt.b)
			if err != nil {
				t.Fatalf("Mul(%v, %v) returned unexpected error: %v", tt.a, tt.b, err)
			}
			if got != tt.want {
				t.Errorf("Mul(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestDiv(t *testing.T) {
	s := NewService()

	t.Run("valid divisions", func(t *testing.T) {
		tests := []struct {
			name string
			a, b float64
			want float64
		}{
			{"exact", 6, 3, 2},
			{"fractional", 1, 2, 0.5},
			{"negative divisor", 6, -3, -2},
			{"zero numerator", 0, 5, 0},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				got, err := s.Div(context.Background(), tt.a, tt.b)
				if err != nil {
					t.Fatalf("Div(%v, %v) returned unexpected error: %v", tt.a, tt.b, err)
				}
				if got != tt.want {
					t.Errorf("Div(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
				}
			})
		}
	})

	// The message is asserted verbatim because the frontend maps it by exact
	// string in calculator-front/lib/errors.ts.
	t.Run("divide by zero", func(t *testing.T) {
		got, err := s.Div(context.Background(), 1, 0)
		if err == nil {
			t.Fatal("Div(1, 0) expected an error, got nil")
		}
		if err.Error() != "cannot divide by zero" {
			t.Errorf("Div(1, 0) error = %q, want %q", err.Error(), "cannot divide by zero")
		}
		if got != 0 {
			t.Errorf("Div(1, 0) = %v, want 0 alongside the error", got)
		}
	})

	t.Run("zero divided by zero", func(t *testing.T) {
		if _, err := s.Div(context.Background(), 0, 0); err == nil {
			t.Fatal("Div(0, 0) expected an error, got nil")
		}
	})
}

func TestSqrt(t *testing.T) {
	s := NewService()

	t.Run("valid roots", func(t *testing.T) {
		tests := []struct {
			name string
			a    float64
			want float64
		}{
			{"zero", 0, 0},
			{"perfect square", 9, 3},
			{"one", 1, 1},
			{"non perfect square", 2, math.Sqrt2},
			{"fraction", 0.25, 0.5},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				got, err := s.Sqrt(context.Background(), tt.a)
				if err != nil {
					t.Fatalf("Sqrt(%v) returned unexpected error: %v", tt.a, err)
				}
				if got != tt.want {
					t.Errorf("Sqrt(%v) = %v, want %v", tt.a, got, tt.want)
				}
			})
		}
	})

	t.Run("negative input", func(t *testing.T) {
		got, err := s.Sqrt(context.Background(), -1)
		if err == nil {
			t.Fatal("Sqrt(-1) expected an error, got nil")
		}
		want := "cannot calculate square root of a negative number"
		if err.Error() != want {
			t.Errorf("Sqrt(-1) error = %q, want %q", err.Error(), want)
		}
		if got != 0 {
			t.Errorf("Sqrt(-1) = %v, want 0 alongside the error", got)
		}
	})
}

func TestExp(t *testing.T) {
	s := NewService()

	tests := []struct {
		name string
		a, b float64
		want float64
	}{
		{"square", 2, 3, 8},
		{"zero exponent", 5, 0, 1},
		// math.Pow defines 0^0 as 1.
		{"zero to the zero", 0, 0, 1},
		{"negative exponent", 2, -1, 0.5},
		{"fractional exponent", 9, 0.5, 3},
		{"negative base integer exponent", -2, 2, 4},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := s.Exp(context.Background(), tt.a, tt.b)
			if err != nil {
				t.Fatalf("Exp(%v, %v) returned unexpected error: %v", tt.a, tt.b, err)
			}
			if got != tt.want {
				t.Errorf("Exp(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}

	// Overflow is not rejected by the service; the handler is responsible for
	// refusing to serialize a non-finite result.
	t.Run("overflow returns infinity without an error", func(t *testing.T) {
		got, err := s.Exp(context.Background(), 1e308, 2)
		if err != nil {
			t.Fatalf("Exp(1e308, 2) returned unexpected error: %v", err)
		}
		if !math.IsInf(got, 1) {
			t.Errorf("Exp(1e308, 2) = %v, want +Inf", got)
		}
	})

	// math.Pow of a negative base with a fractional exponent is undefined.
	t.Run("negative base fractional exponent returns NaN", func(t *testing.T) {
		got, err := s.Exp(context.Background(), -8, 0.5)
		if err != nil {
			t.Fatalf("Exp(-8, 0.5) returned unexpected error: %v", err)
		}
		if !math.IsNaN(got) {
			t.Errorf("Exp(-8, 0.5) = %v, want NaN", got)
		}
	})
}

func TestPer(t *testing.T) {
	s := NewService()

	t.Run("valid percentages", func(t *testing.T) {
		tests := []struct {
			name string
			a, b float64
			want float64
		}{
			{"half", 5, 10, 50},
			{"whole", 10, 10, 100},
			{"over one hundred", 20, 10, 200},
			{"zero numerator", 0, 10, 0},
			{"negative numerator", -5, 10, -50},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				got, err := s.Per(context.Background(), tt.a, tt.b)
				if err != nil {
					t.Fatalf("Per(%v, %v) returned unexpected error: %v", tt.a, tt.b, err)
				}
				if got != tt.want {
					t.Errorf("Per(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
				}
			})
		}
	})

	t.Run("percentage of zero", func(t *testing.T) {
		got, err := s.Per(context.Background(), 5, 0)
		if err == nil {
			t.Fatal("Per(5, 0) expected an error, got nil")
		}
		want := "cannot calculate percentage of zero"
		if err.Error() != want {
			t.Errorf("Per(5, 0) error = %q, want %q", err.Error(), want)
		}
		if got != 0 {
			t.Errorf("Per(5, 0) = %v, want 0 alongside the error", got)
		}
	})
}
