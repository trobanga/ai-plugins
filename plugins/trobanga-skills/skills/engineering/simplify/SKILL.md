---
name: simplify
description: Reviews changed code for reuse, simplification, efficiency and altitude, then fixes the findings. Quality only, it does not hunt for bugs. Use when the user asks to simplify or clean up changed code, or when another skill needs a cleanup pass over its diff.
---

`${CLAUDE_SKILL_DIR}` stands for the directory of this file. If the harness does not expand it, replace it with the absolute path of that directory.

# Simplify: Code Review and Cleanup

Review the changed code for reuse, simplification, efficiency and altitude, and fix the findings. Four reviewers report; only you edit.

You improve the quality of the changed code. You do not hunt for correctness bugs; a code review does that.

## Phase 1: Capture the changes

Write the changes to a fresh folder, so that every reviewer reads the same diff from a file. The scope is the work on the branch: the commits since the branch left its base, plus the uncommitted edits.

```bash
D=$(mktemp -d "${TMPDIR:-/tmp}/simplify.XXXXXX")
BASE=${BASE:-$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)}
if [ -n "$BASE" ]; then
  git diff "$(git merge-base HEAD "$BASE")" > "$D/changes.diff"
else
  git diff HEAD > "$D/changes.diff"
fi
git ls-files --others --exclude-standard > "$D/new-files.txt"
```

`BASE` is the base that the user or the calling skill names, such as `origin/develop`. If none is named, it is the default branch of `origin`. If the repository has no `origin`, the scope is the uncommitted edits only.

If the user names a different target, review that target instead:

- a pull request number: `gh pr diff <number> > "$D/changes.diff"`;
- a branch: `git diff "$BASE...<branch>" > "$D/changes.diff"`;
- a file or directory: add `-- <path>` to the `git diff` command above.

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

## Phase 2: Run four reviewers in parallel

Start the four reviewers below at the same time. Give each one the path of the folder `$D`, the absolute paths of the language files, its own brief, and this instruction: "Read `changes.diff` and every file in `new-files.txt`. In each language file, read the section for your review (Reuse, Simplification or Efficiency; Altitude has no section) and apply it together with your brief. Report each finding with `file:line`, a one-line summary, the concrete cost (what is duplicated, wasted or harder to maintain), and the fix. Do not hunt for bugs. Do not edit files. Under 400 words; say "clean" if you find nothing."

- **Claude Code:** send one message with four `Agent` calls, each with `subagent_type: Explore`, which is read-only.
- **pi:** make one `subagent` call with `workflow: "parallel"` and four tasks for the `reviewer` agent.
- **No subagent tool:** do the four reviews yourself, one after the other.

### Reviewer 1: Reuse

Flag new code that does again what the codebase already does. For each change:

1. **Search for existing utilities and helpers** that could replace new code. Look for similar patterns elsewhere in the codebase: utility directories, shared modules, and files next to the changed ones.
2. **Flag each new function that duplicates existing functionality.** Name the existing function to use instead.
3. **Flag inline logic that could use an existing utility:** hand-rolled string manipulation, manual path handling, custom environment checks, ad-hoc type guards, and similar patterns.

### Reviewer 2: Simplification

Flag complexity that the diff adds, and name the simpler form that does the same job:

1. **Redundant state:** state that duplicates existing state, cached values that could be derived, observers or effects that could be direct calls.
2. **Copy-paste with slight variation:** near-duplicate blocks that one shared abstraction should replace.
3. **Deep nesting:** nested conditionals or loops that an early return, a guard clause or a helper function makes flat.
4. **Dead code left behind:** unused functions, parameters, imports, branches and flags.
5. **Parameter sprawl:** new parameters added to a function instead of a generalized or restructured function.
6. **Leaky abstractions:** internal details exposed that should be encapsulated, or broken abstraction boundaries.
7. **Stringly-typed code:** raw strings where the codebase already has constants, enums, string unions or branded types.
8. **Unnecessary nesting in UI trees:** wrapper elements that add no layout value, where the props of the inner component already give the needed behavior.
9. **Unnecessary comments:** comments that say WHAT the code does (good names already do that), narrate the change, or refer to the task or the caller. Delete them. Keep only a non-obvious WHY: a hidden constraint, a subtle invariant, a workaround.

### Reviewer 3: Efficiency

Flag wasted work that the diff adds, and name the cheaper alternative:

1. **Unnecessary work:** redundant computations, repeated file reads, duplicate network or API calls, N+1 patterns.
2. **Missed concurrency:** independent operations that run one after the other but could run in parallel.
3. **Hot-path bloat:** new blocking work on startup or on a per-request or per-render path.
4. **Recurring no-op updates:** state or store updates in polling loops, intervals or event handlers that fire unconditionally. Add a change-detection guard, so that consumers are not notified when nothing changed. If a wrapper takes an updater or reducer callback, check that it honors the "no change" signal of the callback, such as a same-reference return; otherwise it defeats the early returns of its callers.
5. **Unnecessary existence checks:** a check that a file or resource exists before the operation on it (a TOCTOU anti-pattern). Do the operation and handle the error.
6. **Memory:** unbounded data structures, missing cleanup, event listener leaks. A long-lived object built from a closure keeps the whole enclosing scope alive for its lifetime; when that scope holds large values, prefer a struct or class that copies only the fields it needs.
7. **Overly broad operations:** reading a whole file when a part is enough, loading all items to filter for one.

### Reviewer 4: Altitude

Check that each change fixes the root cause at the right depth, and does not patch a symptom with a fragile workaround:

1. **Special cases on shared infrastructure:** a special case added to a shared mechanism shows that the fix is not deep enough. Name the simpler, more general change to the mechanism.
2. **The wrong layer:** the same fix in several call sites where one place below them would do, or a fix in a view or handler that belongs in the module that owns the data.
3. **Symptom fixes:** a retry, a sleep, a catch-all or a default value that hides why something fails. Name the cause to fix instead.

Done when all four reviewers have reported.

## Phase 3: Fix

Merge the four reports and remove duplicate findings: findings that point at the same line or the same mechanism are one finding. Fix each finding directly in the code.

Skip a finding, with one line why, when:

- its fix changes the intended behavior;
- its fix needs changes well outside the reviewed diff;
- it is a false positive, or not worth the change.

Do not argue with a finding you skip.

These fixes edit code that may already pass its tests. Run the test suite of the project after the fixes. If a test fails, revert the fix that broke it instead of patching around it, and list that finding as skipped.

Done when each finding is fixed or skipped with a reason, and the test suite passes.

End with a short summary: what you fixed, what you skipped and why, or that the code was already clean.
