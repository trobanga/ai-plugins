# TypeScript and JavaScript

Skip what `tsc` and the project's ESLint configuration report; flag only what they miss.

## Reuse

- Hand-written helpers that the platform has: `Array.prototype.flatMap`, `.at`, `.findLast`, `Object.entries`, `Object.fromEntries`, `structuredClone`, `URL`, `URLSearchParams`, `Intl`.
- A type that repeats the shape of another; derive it with `Pick`, `Omit`, `Partial`, `ReturnType` or `typeof`, or with `z.infer` from an existing schema.
- Helpers that a dependency already in `package.json` has, such as lodash. Do not add a new dependency for this.

## Quality

- `any`, `as` casts or non-null `!` that only silence the type checker.
- Hand-written type guards where a discriminated union lets the compiler narrow.
- Raw string literals where a union type or a constant already exists.
- A list of optional or `boolean` parameters; use one options object.
- Exports that no other module imports.
- A class with only static members; use a module with functions.
- React: state that can be derived from props or other state; a `useEffect` that syncs state or that should be an event handler.

## Efficiency

- Independent `await`s one after the other, or `await` inside a loop; use `Promise.all`.
- `find`, `includes` or `indexOf` inside a loop (quadratic); build a `Map` or `Set` once.
- Object or array spread on the accumulator in `reduce` (quadratic); mutate a local accumulator.
- `JSON.parse(JSON.stringify(x))` for a deep copy; use `structuredClone`.
- React: new object or function props on each render that defeat `memo` on the child; costly computation on each render without `useMemo`.
- Listeners, intervals or subscriptions without cleanup in a `useEffect` return.
