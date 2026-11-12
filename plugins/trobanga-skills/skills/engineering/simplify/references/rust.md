# Rust

Skip what `cargo clippy` with its default lints reports; flag only what it misses.

## Reuse

- Hand-written loops that an iterator adapter already does: `sum`, `any`, `all`, `position`, `windows`, `chunks`, `retain`, `dedup`, `zip`.
- `match` ladders on `Option` or `Result` that a combinator replaces: `map`, `and_then`, `ok_or`, `unwrap_or_default`, `transpose`.
- `map_err` at each call site where a `From` impl and `?` would do it once.
- Manual impls of `Default`, `PartialEq`, `Debug`, `Clone` that `#[derive]` gives.
- Error boilerplate that a crate already in `Cargo.toml` covers, such as `thiserror` or `anyhow`.

## Simplification

- `.clone()` that only quiets the borrow checker where a borrow or a restructured scope works.
- Owned parameters (`String`, `Vec<T>`) for functions that only read; take `&str`, `&[T]` or `impl AsRef<_>`.
- `unwrap()` or `expect()` on a path that can fail on input; return a `Result`.
- `bool` parameters, or strings with a fixed set of values; use an `enum`.
- `pub` on items or fields that no other module uses.
- `Rc<RefCell<_>>` or `Arc<Mutex<_>>` where a clear owner would remove the shared mutability.
- A trait with one impl and no test seam; use the type directly.
- `Box<dyn Trait>` where a generic or an `enum` fits.
- `String` or `Box<dyn Error>` as the error type of a library API.

## Efficiency

- `collect()` into a `Vec` only to iterate it again.
- `format!`, `to_string()` or `clone()` inside hot loops.
- A `Vec` or `String` grown in a loop when the size is known; use `with_capacity`.
- A `contains_key` or `get` followed by `insert` that the `entry` API does in one lookup.
- A lock guard held across an `.await` or over a long scope.
- Blocking I/O or CPU-heavy work on an async executor thread; use `spawn_blocking`.
