# Detect mutation testing in a project

Find out if the project does mutation testing, and how. Stop at the
first source that answers:

1. `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`: a documented command or
   a statement on mutation testing.
2. Task runners: `Makefile`, `justfile`, `Taskfile.yml`, the `scripts`
   of `package.json`, `mix.exs` aliases. Look for a target that names
   `mutant`, `mutation`, `stryker`, `pitest` or `pit`.
3. CI: `.github/workflows/`, `.gitlab-ci.yml`. Look for a job that runs
   a mutation tool.
4. Tool configuration: `.cargo/mutants.toml`, `mutants.toml`,
   `stryker.conf.*`, `stryker.config.*`, a `pitest` plugin in `pom.xml`
   or `build.gradle*`, a `gremlins` or `go-mutesting` configuration, a
   `muzak` or `exavier` dependency in `mix.exs`.

If no source answers, report one line — "Mutation step skipped: the
project does not do mutation testing" — and stop. An installed mutation
tool on this machine is not evidence; the project must use it.

If the project uses a tool that is not installed, report the tool and
the install command, and stop. Do not install it yourself.

If a source answers, give the source, the tool, and the command, in one
line each. The command is the one the project uses, before you scope it
to the diff.
