# Go

Skip what `go vet` and `staticcheck` report; flag only what they miss.

## Reuse

- Hand-written helpers that the standard library has: `slices.Contains`, `slices.Index`, `slices.SortFunc`, `maps.Keys`, the `min` and `max` builtins, `strings.Cut`, `sync.OnceValue`.
- Error checks by string comparison where `errors.Is` or `errors.As` works.
- Path building by string concatenation instead of `filepath.Join`.
- A new helper next to an equal one in the same module; search the module first.

## Quality

- Errors wrapped without `%w`, so callers cannot use `errors.Is`.
- Errors that are ignored or only logged where the caller must know.
- An interface declared next to its only implementation; declare it at the consumer, or drop it.
- Functions that return an interface where a concrete type works.
- `bool` parameters; use a named type with constants, or two functions.
- Goroutines without a clear end: no `context`, no `sync.WaitGroup`, no `errgroup`.
- Package-level mutable state, or `init()` with side effects.
- `panic` for an expected failure in library code.
- Names that stutter (`user.UserService`) or getters named `GetX`.

## Efficiency

- `append` in a loop when the length is known; use `make` with a capacity.
- String concatenation in a loop; use `strings.Builder`.
- `defer` inside a loop, which holds every resource until the function returns.
- `regexp.MustCompile` inside a function that runs often; compile once at package level.
- A goroutine that blocks forever on a channel send or receive (a leak).
- Large structs copied by value in `range` loops or parameters.
- Repeated conversions between `[]byte` and `string`.
