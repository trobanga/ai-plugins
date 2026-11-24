# trobanga-skills

Skills for engineering work, game development, and writing, plus five
subagents, for Claude Code and pi. The model loads a skill by itself when the
task matches its description. You can also call one by name:
`/trobanga-skills:tdd` in Claude Code, `/skill:tdd` in pi.

## Install

Claude Code:

```
/plugin marketplace add trobanga/ai-plugins
/plugin install trobanga-skills@trobanga
```

pi (the subagents also need the `pi-subagents` package):

```
pi install git:github.com/trobanga/ai-plugins
```

The plugin installs no hooks.

## Engineering

| Skill | What it does |
| --- | --- |
| `tdd` | The red-green-refactor loop. One failing test, then the smallest code that passes it. |
| `patch-coverage` | Measures coverage of the branch diff with diff-cover. Java, Go, Rust, Elixir. Measures only. |
| `improve-coverage` | Raises patch coverage toward a target by writing real tests, file by file. |
| `crap-score` | Computes the CRAP score (complexity against coverage) of every changed function. Measures only. |
| `mutation-testing` | Runs the project's own mutation tool on the branch diff and adds a test for each surviving mutant. Stops if the project does no mutation testing. |
| `simplify` | Reviews changed code for reuse, quality and efficiency with three parallel reviewers, then fixes the findings. |
| `conformance-review` | Reviews a branch against the repo's coding standards and against the originating issue. |
| `improve-codebase-architecture` | Finds deepening opportunities, guided by `GLOSSARY.md` and the ADRs. |
| `domain-modeling` | Pins down the ubiquitous language and records architectural decisions. |
| `implement` | Works a tracked issue in a fresh worktree: claim, explore, design, test-first, CRAP, mutants, local CI, then a fast-forward merge into the default branch, or a PR with `--pr`. GitHub, Linear or beads. |
| `worktree-cleanup` | Removes worktrees left behind by finished issues, after it checks their state. |
| `draft-issue` | Drafts one issue as a news article: the important part first, then the details an agent needs. Files nothing. |
| `file-issue` | Writes one issue the same way and files it on the tracker at once. |
| `pr` | Writes a pull request body: summary with a diagram, the change running, and risks. |
| `show-me` | Explains the current topic with diagrams, code sketches and focused HTML pages. |
| `reverse-engineer-anything` | Reverse engineers binaries, managed code, Electron apps, firmware and browser targets with REA. |
| `setup-project` | Records the project's issue tracker, forge and branch format so the other skills stop guessing. |
| `orchestrate` | Slices a locked spec into vertical slices, decides per slice whether to delegate, and merges each reviewed slice directly or through PRs. |
| `wayfinder` | Maps work too large for one session as a set of decision tickets. |
| `to-spec` | Turns the current conversation into a spec and files it in the issue tracker. |
| `to-tickets` | Breaks a plan into tracer-bullet tickets. |
| `grill-with-docs` | Interviews you to sharpen a design, and writes ADRs and a glossary as it goes. |
| `prototype` | Builds a throwaway prototype to answer one design question. |
| `research` | Investigates a question against primary sources and writes the findings to a file. |
| `zoom-out` | Gives the broader context when the work has lost its frame. |

## Game development

| Skill | What it does |
| --- | --- |
| `bevy` | Bevy 0.19 ECS: current API, system ordering, observers and messages, UI, builds. |
| `godot` | Godot 4 GDScript: scene architecture, signals, resources, state machines, pooling, save systems. |
| `godot-ui` | Control nodes, themes, responsive layout, menus, HUDs, inventories, dialogue. |

## Productivity and writing

| Skill | What it does |
| --- | --- |
| `grilling` | Stress-tests a plan or a decision with relentless questions. |
| `writing-great-skills` | The principles that make a skill load at the right time and act predictably. |
| `handoff` | Writes the conversation into a handoff document; with `bg`, starts a background agent on it. |
| `idea` | Captures an idea as a Markdown file that reads like a news article. |
| `ste` | Switches the session to ASD-STE100 Simplified Technical English. |
| `teach` | Teaches a concept inside this workspace, with a glossary and a learning record. |
| `reflect` | Reviews sessions or the steering files and proposes ranked changes; applies only the approved ones. |
| `evaluate-skill` | Measures whether a skill changes the agent's behaviour, with `claude plugin eval`. Claude Code only. |
| `beamcast` | Writes, validates and pushes Beamcast slide decks through the Beamcast API. |

## Design

| Skill | What it does |
| --- | --- |
| `refactoring-ui` | Audits and fixes visual hierarchy, spacing, color, and depth in web UIs. |

## Subagents

`crap-agent` computes the CRAP score of every changed function and then brings
each one below the threshold, by adding tests or by extracting functions. It
supports Java, Go, Rust, TypeScript, and Elixir.

`mutant-agent` runs the `mutation-testing` skill in a subagent on Sonnet, so the
long mutation runs stay out of the caller's context. `implement` detects mutation
testing itself and launches the agent only when the project does it.

`tdd-implementer-low`, `tdd-implementer-medium` and `tdd-implementer-high` run the
`tdd` loop on Sonnet for an approved plan. `implement` writes the brief, selects the
variant by effort, and verifies the result. The three files differ only in `effort`,
because the `Agent` tool cannot set effort for each call.

The agents are generated from `src/agents/` at the repository root: Claude Code
reads `agents/`, pi reads `pi/agents/`. Edit the source, not the output.

## Requirements

Most skills need only `git`. These need more:

- `patch-coverage`, `improve-coverage`, `crap-score`: `python3`, `diff-cover`,
  and the coverage tool of the language (JaCoCo, `go test -cover`,
  `cargo-tarpaulin`, ExCoveralls).
- `implement`, `worktree-cleanup`: `git`, plus the tool of the tracker in use —
  the `gh` command line program for GitHub, the `bd` command line program for beads, or a
  connected Linear MCP server for Linear.

## Credits

> "Good coders copy, great coders steal."
>
> — attributed to Pablo Picasso

These fourteen skills are derived from
[mattpocock/skills](https://github.com/mattpocock/skills) by Matt Pocock:

`conformance-review`, `domain-modeling`, `grill-with-docs`, `grilling`,
`handoff`, `improve-codebase-architecture`, `prototype`, `reflect`, `research`,
`tdd`, `teach`, `to-spec`, `to-tickets`, `wayfinder`.

They stay under his MIT licence. See
[LICENSES/mattpocock-skills-MIT.txt](LICENSES/mattpocock-skills-MIT.txt).

`show-me` and `pr` are derived from
[humanlayer/skills](https://github.com/humanlayer/skills) by Dex Horthy at
HumanLayer. They stay under its MIT licence. See
[LICENSES/humanlayer-skills-MIT.txt](LICENSES/humanlayer-skills-MIT.txt).

`reverse-engineer-anything` is the REA skill from
[morluto/rea](https://github.com/morluto/rea) by morluto. It stays under its MIT
licence. See [LICENSES/rea-MIT.txt](LICENSES/rea-MIT.txt).

`improve-codebase-architecture` also draws on "Design It Twice" from John
Ousterhout, *A Philosophy of Software Design*.

## License

The skills credited above are MIT, per their upstream licence. Everything else
is Apache-2.0. See the [LICENSE](../../LICENSE) at the repository root.
