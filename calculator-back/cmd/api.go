package main

import (
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/hehe-catto/calculator/calculator-back/internal/operations"
)

// global struct -> my api will have methods that are going to run and mounts my api (create handlers, signatures)
type application struct {
	config config
}

// mount
func (app *application) mount() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.ClientIPFromRemoteAddr)

	// middleware
	r.Use(middleware.RequestID) // important for rate limit
	r.Use(middleware.Logger)    // important for rate limit, analytics ans tracing
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	calcService := operations.NewService()
	calcHandler := operations.NewHandler(calcService)

	r.Route("/v1/operations", func(sub chi.Router) {
		sub.Get("/sum", calcHandler.SumOperation)
		sub.Get("/sub", calcHandler.SubOperation)
		sub.Get("/mul", calcHandler.MulOperation)
		sub.Get("/div", calcHandler.DivOperation)
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("hello"))
	})

	return r
}

// run
func (app *application) run(h http.Handler) error {
	srv := &http.Server{
		Addr:         app.config.addr,
		Handler:      h,
		WriteTimeout: 30 * time.Second,
		ReadTimeout:  10 * time.Second,
		IdleTimeout:  time.Minute,
	}

	log.Printf("Server has started at addr %s", app.config.addr)
	return srv.ListenAndServe()
}

type config struct {
	addr string
}
