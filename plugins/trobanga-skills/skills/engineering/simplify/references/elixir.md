# Elixir

Skip what the compiler warnings, `mix credo` and Dialyzer report; flag only what they miss.

## Reuse

- Hand-written recursion or `Enum.reduce` that a library function does: `Enum.group_by`, `Enum.frequencies`, `Enum.chunk_every`, `Map.update/4`, `get_in`, `put_in`, `update_in`.
- A new function that repeats one in an existing context module; call the context.
- Hand-written validation that an `Ecto.Changeset` validator does.

## Simplification

- Nested `case` on `{:ok, _}` and `{:error, _}`; use `with`.
- `if`/`cond` chains on the shape of data; use pattern-matching function heads.
- Raising for an expected failure in a function without `!`; return `{:error, reason}`.
- Mixed return contracts in one module: some functions return tuples, some raise, some return `nil`.
- Strings with a fixed set of values; use atoms. Never call `String.to_atom` on outside input.
- A `GenServer` or `Agent` that holds no state and serializes nothing; use plain functions.
- `def` on functions that no other module calls; use `defp`.
- `Application.get_env` read in hot code, or `Application.compile_env` for a value that changes at runtime.

## Efficiency

- Long `Enum` pipelines over large collections that build an intermediate list at each step; use `Stream` or one `Enum.reduce`.
- `list ++ [item]` in a loop; prepend and reverse once at the end.
- `length(list) == 0` or `Enum.count(list) > 0`; match on `[]` or use `Enum.empty?`.
- `Repo` calls inside a loop (N+1 queries); use `preload`, a join or `Repo.insert_all`.
- One `GenServer` that all callers go through, which makes it a bottleneck; read from ETS instead.
- Large terms sent between processes, which copies them.
- String concatenation in a loop; build iodata.
