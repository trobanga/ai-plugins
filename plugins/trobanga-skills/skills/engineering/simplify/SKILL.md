---
name: simplify
description: Reviews changed code for reuse, quality and efficiency, then fixes the findings. Use when the user asks to simplify or clean up changed code, or when another skill needs a cleanup pass over its diff.
---

`${CLAUDE_SKILL_DIR}` stands for the directory of this file. If the harness does not expand it, replace it with the absolute path of that directory.

# Simplify: Code Review and Cleanup

Review the changed code for reuse, quality and efficiency, and fix the findings. Three reviewers report; only you edit.

## Phase 1: Capture the changes

Write the changes to a fresh folder, so that every reviewer reads the same diff from a file:

```bash
D=$(mktemp -d "${TMPDIR:-/tmp}/simplify.XXXXXX")
git diff HEAD > "$D/changes.diff"
git ls-files --others --exclude-standard > "$D/new-files.txt"
```

If the user or the calling skill names a base, such as the default branch, use `git diff <base>` instead of `git diff HEAD`. It covers the commits since the base and the uncommitted edits.

If both files are empty, review the files that the user named or that you edited earlier in this conversation. If there are none, report that there is nothing to review and stop.

Then pick the language files for the reviewers from the file extensions in the changes:

| Extensions | Language file |
| --- | --- |
| `.rs` | `${CLAUDE_SKILL_DIR}/references/rust.md` |
| `.go` | `${CLAUDE_SKILL_DIR}/references/go.md` |
| `.java` | `${CLAUDE_SKILL_DIR}/references/java.md` |
| `.ex`, `.exs` | `${CLAUDE_SKILL_DIR}/references/elixir.md` |
| `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` | `${CLAUDE_SKILL_DIR}/references/typescript.md` |

Done when `$D/changes.diff` and `$D/new-files.txt` exist and at least one of them is not empty, and you have the list of language files (it can be empty); or when you have stopped.

## Phase 2: Run three reviewers in parallel

Start the three reviewers below at the same time. Give each one the path of the folder `$D`, the absolute paths of the language files, its own brief, and this instruction: "Read `changes.diff` and every file in `new-files.txt`. In each language file, read the section for your review (Reuse, Quality or Efficiency) and apply it together with your brief. Report each finding with `file:line`, the problem and the fix. Do not edit files. Under 400 words."

- **Claude Code:** send one message with three `Agent` calls, each with `subagent_type: general-purpose`.
- **pi:** make one `subagent` call with `workflow: "parallel"` and three tasks for the `reviewer` agent.
- **No subagent tool:** do the three reviews yourself, one after the other.

### Reviewer 1: Code reuse

For each change:

1. **Search for existing utilities and helpers** that could replace new code. Look for similar patterns elsewhere in the codebase: utility directories, shared modules, and files next to the changed ones.
2. **Flag each new function that duplicates existing functionality.** Name the existing function to use instead.
3. **Flag inline logic that could use an existing utility:** hand-rolled string manipulation, manual path handling, custom environment checks, ad-hoc type guards, and similar patterns.

### Reviewer 2: Code quality

Review the same changes for hacky patterns:

1. **Redundant state:** state that duplicates existing state, cached values that could be derived, observers or effects that could be direct calls.
2. **Parameter sprawl:** new parameters added to a function instead of a generalized or restructured function.
3. **Copy-paste with slight variation:** near-duplicate blocks that one shared abstraction should replace.
4. **Leaky abstractions:** internal details exposed that should be encapsulated, or broken abstraction boundaries.
5. **Stringly-typed code:** raw strings where the codebase already has constants, enums, string unions or branded types.
6. **Unnecessary nesting in UI trees:** wrapper elements that add no layout value, where the props of the inner component already give the needed behavior.
7. **Unnecessary comments:** comments that say WHAT the code does (good names already do that), narrate the change, or refer to the task or the caller. Delete them. Keep only a non-obvious WHY: a hidden constraint, a subtle invariant, a workaround.

### Reviewer 3: Efficiency

Review the same changes for efficiency:

1. **Unnecessary work:** redundant computations, repeated file reads, duplicate network or API calls, N+1 patterns.
2. **Missed concurrency:** independent operations that run one after the other but could run in parallel.
3. **Hot-path bloat:** new blocking work on startup or on a per-request or per-render path.
4. **Recurring no-op updates:** state or store updates in polling loops, intervals or event handlers that fire unconditionally. Add a change-detection guard, so that consumers are not notified when nothing changed. If a wrapper takes an updater or reducer callback, check that it honors the "no change" signal of the callback, such as a same-reference return; otherwise it defeats the early returns of its callers.
5. **Unnecessary existence checks:** a check that a file or resource exists before the operation on it (a TOCTOU anti-pattern). Do the operation and handle the error.
6. **Memory:** unbounded data structures, missing cleanup, event listener leaks.
7. **Overly broad operations:** reading a whole file when a part is enough, loading all items to filter for one.

Done when all three reviewers have reported.

## Phase 3: Fix

Merge the three reports and remove duplicate findings. Fix each finding directly in the code. If a finding is a false positive or not worth the change, write one line why and skip it; do not argue with it.

These fixes edit code that may already pass its tests. Run the test suite of the project after the fixes. If a test fails, revert the fix that broke it instead of patching around it, and list that finding as skipped.

Done when each finding is fixed or skipped with a reason, and the test suite passes.

End with a short summary: what you fixed, what you skipped and why, or that the code was already clean.
