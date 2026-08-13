package main

import (
	"log/slog"
	"os"
)

func main() {
	cfg := config{
		addr: ":8080",
	}
	api := application{
		config: cfg,
	}
	h := api.mount()
	// logger
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	if err := api.run(h); err != nil {
		slog.Error("Server failed to start", "error", err)
		os.Exit(1)
	}
}
