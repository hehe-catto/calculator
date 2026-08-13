# Calculator-back

## Design decisions

We will be using dependency injection, it makes the code easier to test.

### Architecture

The project has a Clean Architecture, with the following layers:

- Transport (HTTP): decoupled routing. The input validation is integrated in the handlers. Manages HTTP status codes ans serialization of JSON responses
- Service (Business logic): Go domain logic, it executes the operations of the calculator and its related validation.

### Files roles

- **cmd/main.go**: its responsability is compose dependencies (services, handleers) and call the program: start the appplication.
- **cmd/api.go**: mounts and runs the app, injects middleware.
- **internal/operations**: contains core domain logic.

### References

1. Docker Image
   https://hub.docker.com/_/golanghttps://hub.docker.com/_/golang
2. Architecture
   https://youtu.be/s3XItrqfccw?si=Ze_2e7fMptIiZqDV
