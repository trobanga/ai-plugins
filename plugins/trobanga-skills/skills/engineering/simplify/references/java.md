# Java

Skip what the project's configured checkers report (compiler warnings, and Error Prone, SpotBugs, PMD or Checkstyle if the build runs them); flag only what they miss.

## Reuse

- Hand-written helpers that the JDK has: `Objects.requireNonNull`, `Objects.equals`, `Objects.hash`, `List.of`, `Map.of`, `String.join`, `String.isBlank`, `String.repeat`.
- Hand-written value classes (fields, `equals`, `hashCode`, `toString`) where a `record` fits.
- `try`/`finally` blocks that close a resource; use try-with-resources.
- Helpers that a library already on the classpath has, such as Guava or Apache Commons. Do not add a new dependency for this.

## Simplification

- `catch (Exception e)` or `catch (Throwable t)` that is too broad, or a catch block that swallows the exception.
- A checked exception rethrown as a `RuntimeException` without the cause.
- `null` returned where an empty collection or `Optional` fits; `Optional` used as a field or parameter.
- Getters that expose an internal mutable collection; return an unmodifiable view or a copy.
- `boolean` flag parameters, or telescoping constructors; use an `enum`, a `record` or a builder.
- Static mutable state or hand-made singletons.
- `instanceof` chains where a sealed type with a pattern-matching `switch` fits (Java 21 or later), or a method on the type.
- Inheritance used only to share code; use composition.

## Efficiency

- String concatenation in a loop; use `StringBuilder`.
- Boxed types (`List<Integer>`, `Long`) in hot numeric loops.
- `Pattern.compile`, `new ObjectMapper()` or other costly objects created on each call; create them once.
- ORM lazy loading in a loop (N+1 queries); fetch with a join or in a batch.
- A `HashMap` used as a cache with no bound or eviction.
- `synchronized` on a whole method where a smaller critical section or a concurrent collection works.
