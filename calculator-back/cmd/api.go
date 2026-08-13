package main

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/hehe-catto/calculator/calculator-back/internal/operations"
)

type application struct {
	config config
}

func (app *application) mount() http.Handler {
	r := chi.NewRouter()
	// Behind nginx, RemoteAddr is always the proxy. X-Real-IP is set unconditionally
	// by the proxy, so it cannot be spoofed by the client.
	r.Use(middleware.ClientIPFromHeader("X-Real-IP"))

	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	calcService := operations.NewService()
	calcHandler := operations.NewHandler(calcService)

	r.Route("/v1/operations", func(sub chi.Router) {
		sub.Get("/sum", calcHandler.SumOperation())
		sub.Get("/sub", calcHandler.SubOperation())
		sub.Get("/mul", calcHandler.MulOperation())
		sub.Get("/div", calcHandler.DivOperation())
		sub.Get("/exp", calcHandler.ExpOperation())
		sub.Get("/per", calcHandler.PerOperation())
		sub.Get("/sqrt", calcHandler.SqrtOperation())
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("hello"))
	})

	return r
}

func (app *application) run(h http.Handler) error {
	srv := &http.Server{
		Addr:         app.config.addr,
		Handler:      h,
		WriteTimeout: 30 * time.Second,
		ReadTimeout:  10 * time.Second,
		IdleTimeout:  time.Minute,
	}

	slog.Info("server has started", "addr", app.config.addr)
	return srv.ListenAndServe()
}

type config struct {
	addr string
}

// normalizePort accepts either "8080" or ":8080" and always returns ":8080",
// since platforms inject PORT without the leading colon ListenAndServe needs.
func normalizePort(p string) string {
	if p == "" {
		return ":8080"
	}
	if !strings.HasPrefix(p, ":") {
		return ":" + p
	}
	return p
}
