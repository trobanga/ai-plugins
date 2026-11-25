---
name: crap-score
description: Compute the CRAP score (Change Risk Anti-Patterns) of every function changed on the current branch, from a coverage report and a git diff, and fail above a threshold. Supports Java, Kotlin, Go, Rust, TypeScript and Elixir. Measures only and writes no tests. Use when the user asks for a CRAP score, a complexity-times-coverage check, or which changed functions are risky. To fix the violations, use the crap-agent.
allowed-tools: Bash, Read, Glob
---

# CRAP score of changed functions

`${CLAUDE_SKILL_DIR}` stands for the directory of this file. If the harness does not expand it, replace it with the absolute path of that directory.

    CRAP(f) = cc(f)^2 * (1 - coverage(f))^3 + cc(f)

`cc` is the cyclomatic complexity of the function, `coverage` its test
coverage in [0, 1]. With full coverage the score equals `cc`. Only
functions that contain a line added by the diff are scored. Default
threshold: 8.

## Structure

The skill has one entry point and one collector per language, in
`${CLAUDE_SKILL_DIR}/scripts/`:

- `crap_score.py` detects the project type, runs the collector, scores.
- `crap_core.py` maps the diff to functions and computes the score.
- `collect_java.py` and its siblings read a coverage report and write
  "function records", one JSON object per line:

      {"file": "src/foo.go", "name": "Foo.bar", "start": 10, "end": 14,
       "cc": 3, "coverage": 0.5, "kind": "branch"}

`end` may be `null`, which means "to the end of the file". `kind` names
the coverage kind and appears in the footer of the table.

## Prerequisites

- Python 3, no third-party packages.
- The coverage tool of the language, see the language section below.

## Instructions

1. Build fresh coverage with the command of the language section. Do not
   reuse an old report, it may describe old code. Run the build outside
   the Bash sandbox: coverage tools write to the toolchain caches, and
   Mockito cannot attach its agent inside it.

   A failing test stops the procedure: report it and score nothing,
   because the coverage of a red run describes code that does not work.
   If the project's AGENTS.md or CLAUDE.md documents tests that fail
   locally, exclude exactly those from the build instead.
2. Score the branch against its base. The base is the ref the user or
   the caller names. If none is named, use the default branch of
   `origin`:

       BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)
       python3 ${CLAUDE_SKILL_DIR}/scripts/crap_score.py \
         --range "$BASE...HEAD" --threshold 8

   `--report` gives the report path. Only Java and Kotlin need it,
   because the report lies in the module. `--lang
   java|kotlin|go|rust|elixir|ts` overrides the detected project type.
   `--diff FILE` or `--diff -` takes a unified diff instead of a range.
   With `--range`, the script fails when the report is older than a
   changed source file. Rebuild the report then.

Show the table verbatim. Exit code 1 means at least one function is at or
above the threshold.

## Java

- Detected by `pom.xml`. Coverage: **branch**, line for methods without
  branches. The diff also takes `*.kt`, so a Kotlin module on Maven is
  scored here; the Kotlin rules below apply to it.
- Needs the JaCoCo Maven plugin.
- Build the report per changed module. The module of a file in
  `git diff --name-only "$BASE...HEAD" -- '*.java' '*.kt'` is the nearest
  directory above it that holds a `pom.xml`. For the root module, drop
  `-pl`.

      mvn verify -pl <m1>,<m2> --also-make -q
      mvn jacoco:report -pl <m> -Djacoco.dataFile=target/jacoco.exec -q

- Report: `<m>/target/site/jacoco/jacoco.xml`. Give it with `--report`,
  and score each module in a run of its own.
- Lambdas and the methods of anonymous classes (`Foo$1`) keep no record
  of their own. Their decisions (cc - 1), branches and lines count for
  the method whose range holds their first line. A lambda in a field
  initializer above the first method counts for no method.
  `--include-lambdas` scores them as own methods instead, and does not
  add them to the method around them.
- JaCoCo gives only the first code line of a method. A method ends where
  the next method of the same source file starts, across inner classes.
  An edit above the first code line (annotation, signature, Javadoc)
  therefore maps to the preceding method. Methods with the same first
  line share one range.
- Verified on a Maven project with JaCoCo 0.8.15: a method with four
  `if` statements and 5 of 8 branches covered scores 6.3 at cc 5.

## Kotlin

- Detected by `build.gradle.kts` or `build.gradle`. Coverage: **branch**,
  line for functions without branches. The collector is the one of Java;
  this entry also scores the changed `*.java` files of a Gradle build.
- Needs the JaCoCo plugin of Gradle. Gradle writes no XML report by
  default, so turn it on:

      // build.gradle.kts
      plugins { jacoco }
      tasks.jacocoTestReport { reports { xml.required = true } }

- Build the report per changed module, from the repository root. The
  module of a file in `git diff --name-only "$BASE...HEAD" -- '*.kt'
  '*.java'` is the nearest directory above it that holds a
  `build.gradle.kts` or `build.gradle`. For a single-module build, drop
  the `:<m>` prefix and the `<m>/` of the report path.

      ./gradlew :<m>:test :<m>:jacocoTestReport

- Report: `<m>/build/reports/jacoco/test/jacocoTestReport.xml`. Give it
  with `--report`, score each module in a run of its own, and run the
  script from the repository root.
- Kover is not verified. Use the JaCoCo plugin.
- A top-level function belongs to the class of its file:
  `a/b/FooKt.bar`. A function of a companion object is
  `a/b/Foo$Companion.bar`.
- Kotlin lets the directory of a file differ from its package. JaCoCo
  names the file by its package, so the collector reads the `package`
  line of every `*.kt` file that `git ls-files` lists, and gives the
  record the real path. If two files have the same package and the same
  name, the record keeps the path of JaCoCo and may match no diff line.
- A function with default arguments has a wrapper `bar$default` that
  starts at the signature line. The collector merges it into `bar`, so
  an edit of a default value maps to `bar`.
- Lambdas (`bar$lambda$0`), the methods of anonymous objects and the
  classes of suspend lambdas (`FooKt$bar$1`) count for the function
  around them, as in Java. The body of a `launch { }`, a callback or an
  `object :` therefore raises the score of that function. The lambda of
  an `inline` function such as `map` or `let` is copied into its caller
  and counts there anyway. A local function `bar$helper` keeps a record
  of its own.
- The constructor of a data class and the getters of its properties
  have the same first line and share one range. JaCoCo filters the
  generated `equals`, `hashCode`, `toString`, `copy` and `componentN`.
- The complexity comes from the bytecode: `?.`, `?:`, `&&`, `||` and
  each arm of `when` are decisions.
- A caller of an `inline` function runs a copy of its body, so no test
  covers the body itself. JaCoCo 0.8.12 reports it as uncovered at its
  full complexity; JaCoCo 0.8.15 reports cc 1. Tests cannot fix it.
- A `suspend` function keeps one record. JaCoCo filters its state
  machine.
- Verified with Kotlin 2.1.0, on Maven with JaCoCo 0.8.12 and 0.8.15
  and on Gradle 9.9.2 with JaCoCo 0.8.15: a function with
  `if (x > 0 && y > 0)` and 2 of 4 branches covered scores 4.1 at
  cc 3, on all three builds. A function with one `launch { if ... }` and
  1 of 2 branches covered scores 2.5 at cc 2 (Maven, JaCoCo 0.8.15).
  A `--range` run with the commands above
  scored a changed function on Maven (detected) and in a Gradle
  subproject.

## Go

- Detected by `go.mod`. Coverage: **statement**.
- Needs the Go toolchain, nothing else. The helper `crap_funcs.go` reads
  the complexity and the line range of every function from the Go AST.
- Build the report from the repository root:

      go test -count=1 -coverpkg=./... -coverprofile=coverage.out ./...

  `-coverpkg=./...` counts the tests that live in a package of their
  own; patch-coverage builds the same profile.
- Report: `coverage.out`, the default of `--report`.
- Coverage is the share of covered statements of the function. The cover
  tool cuts a block at every branch, so an uncovered branch always lowers
  the number, but a branch without statements stays invisible.
- A function literal keeps no record of its own. Its branches raise the
  complexity of the function around it.
- Verified on a Go module: a function with four `if` statements and 6 of
  9 statements covered scores 5.9 at cc 5.

## Rust

- Detected by `Cargo.toml`. Coverage: **line**.
- Needs two tools:

      cargo install cargo-llvm-cov
      cargo install cargo-crap

  `cargo llvm-cov` also needs the `llvm-tools` component of the
  toolchain. It installs it on the first run and asks before it does.
- Build the report from the crate root:

      cargo llvm-cov --lcov --output-path lcov.info

- Report: `lcov.info`, the default of `--report`. The collector runs
  `cargo crap --lcov lcov.info --format json` over it, which reads the
  complexity of every function from the source with `syn`.
- Coverage is the share of covered lines, from the `DA` records of the
  LCOV file. `cargo llvm-cov --lcov` on a stable toolchain writes no
  branch records (`BRF:0`), so branch coverage is not available. A `match`
  arm that no test reaches lowers the number, but only through the lines
  it holds.
- cargo-crap gives the first line of a function and no last line, so a
  function ends where the next function of the same file starts. An edit
  above the first line of a function (attribute, doc comment) therefore
  maps to the preceding function.
- cargo-crap has a threshold of its own. crap-score ignores it and
  applies `--threshold`.
- Verified on a crate with cargo-crap 0.4.3: a function with four
  decisions and 9 of 11 lines covered scores 5.2 at cc 5, the same value
  cargo-crap reports itself.

## TypeScript and JavaScript

- Detected by `package.json`. Coverage: **branch**, statement for
  functions without branches.
- Needs an Istanbul `coverage-final.json`. Vitest, Jest, nyc and c8 all
  write it. With Vitest, ask for the Istanbul provider, because the V8
  provider writes no `fnMap`:

      // vitest.config.ts
      test: { coverage: { provider: "istanbul", reporter: ["json"] } }

  Then:

      npx vitest run --coverage

  With Jest: `npx jest --coverage --coverageReporters=json`.
- Report: `coverage/coverage-final.json`, the default of `--report`.
- The complexity is one plus the decisions of the branches inside the
  function: a branch with n paths counts n - 1. A default argument
  counts as no decision, Istanbul gives it one path only.
- Anonymous functions keep no record of their own; their branches raise
  the complexity of the function around them.
  `--include-anonymous` on the collector scores them separately.
- A named function inside another function is counted twice: once alone,
  once in the range of the function around it.
- Verified with Vitest 2.1 and the Istanbul provider: a function with
  four `if` statements and 5 of 8 branch paths covered scores 6.3 at
  cc 5, the same numbers as the equal Java method.

## Elixir

- Detected by `mix.exs`. Coverage: **line**.
- Needs ExCoveralls in the project and the Elixir toolchain, nothing
  else. The helper `crap_funcs.exs` reads the complexity and the line
  range of every function clause from the Elixir AST, with the standard
  library only.

      # mix.exs
      test_coverage: [tool: ExCoveralls],
      deps: [{:excoveralls, "~> 0.18", only: :test}]

- Build the report from the project root:

      MIX_ENV=test mix coveralls.lcov

- Report: `cover/lcov.info`, the default of `--report`. ExCoveralls
  writes absolute source paths; the collector makes them relative to
  the working directory, so run the script from the project root.
- Coverage is the share of covered lines, from the `DA` records of the
  LCOV file. Erlang's `cover` has no branch counts, so a `case` arm that
  no test reaches lowers the number only through the lines it holds.
- One record per `def`, `defp`, `defmacro` or `defmacrop` clause, so
  the ranges stay exact. A function with several clauses is named
  `Mod.name/arity#n`, with `n` the index of the clause; a function with
  one clause is `Mod.name/arity`. Merging the clauses would be closer
  to the complexity of the whole function, but a merged range could
  swallow a function that sits between two clauses.
- Decisions: `if` and `unless`; each arm of `case`, `cond`, `receive`,
  `try` and `with ... else`, except a final `_` or `true` arm; each `<-`
  step of a `with`; each filter of a `for`; `&&`, `||`, `and`, `or`; and
  a guard on the clause head plus every `and`, `or` and `when` inside
  it. A guard on a `case` arm adds nothing, the arm is the decision.
- An anonymous `fn` keeps no record of its own. Each of its clauses
  after the first and each decision in its body raise the complexity of
  the function around it.
- Functions that a macro generates (Ecto schema, Phoenix controller
  plugs, `use` callbacks) are not in the source AST, so they get no
  record. That under-reports and never gives a wrong number.
- Umbrella projects: run the script in each app directory with its own
  `cover/lcov.info`, as with the Java per-module loop.
- Verified with Elixir 1.20 and ExCoveralls 0.18.5: a function with an
  `if` and a three-arm `cond` before a `true` arm, 4 of 6 lines covered,
  scores 5.9 at cc 5, the same value as the equal Go function.

## Tests

    python3 -m unittest discover -s ${CLAUDE_SKILL_DIR}/scripts
