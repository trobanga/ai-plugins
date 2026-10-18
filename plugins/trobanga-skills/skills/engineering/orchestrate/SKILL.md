---
name: orchestrate
description: Implement a locked spec by slicing it into vertical slices and deciding, per slice, which subagent builds it at which model and effort. Merges each reviewed slice directly into the default branch, or works through pull requests and optionally merges the green ones.
disable-model-invocation: true
---

You are the orchestrator for implementing a locked spec. The spec lives in the issue given as the argument. Resolve the tracker and forge by reading `${CLAUDE_SKILL_DIR}/../implement/references/resolve-config.md`, then fetch the issue with its adapter's T1.

## Setup

1. Read the full spec. It is LOCKED — implement it as written. For the reasoning behind a decision, follow the spec's references (decision map, research docs); the spec itself does not re-argue anything.
2. Read the ADRs the spec touches and the project's domain glossary. Use its terms exactly.
3. If the issue is an epic, its children are the candidate slices. Read each child and decide whether it needs further slicing — slice further only when a child is too large to build and verify in one pass. If the issue is not an epic, cut the spec into vertical slices (for a backend: migration + endpoint + tests + docs per slice). File each new slice with operation T6 of `${CLAUDE_SKILL_DIR}/../implement/references/trackers/{TRACKER}.md`, the spec issue as its parent, and wire each dependency between slices with T7.
4. Get the plan approved before the first build. Show the slice list with, per slice, the call (see **Own the call**) and its one-line reason, then ask with `AskUserQuestion`:
   - how slices land (see **Merge**):
     - **direct merge** (the default): you fast-forward the default branch to each reviewed slice; no pull request, no remote CI;
     - **pull requests, the user merges**;
     - **pull requests, you merge the green ones**, with which method (`merge`, `squash`, `rebase`) — only on a forge with F6;
   - whether to post the run summary on the epic at the end.

   This approval is the user's consent to each delegation in it. A delegation you add later needs its own yes.

Completion criterion for setup: every requirement in the spec is covered by exactly one filed slice, and the user approved the plan. For a pre-sliced epic this is an audit: check the children against the spec for gaps and stale slices, and file or retire slices until the criterion holds.

## Own the call

You never write or edit code, tests or docs yourself — not a slice, not a fixup, not a review finding. Every change goes to a subagent. You slice, brief, review, merge and report. For each slice, state the call and the reason in one line — this record is the point.

The call has three parts:

- **Shape.** Normally a whole slice as one commit: a `general-purpose` agent with `isolation: "worktree"` runs `Skill(trobanga-skills:implement)` with `<id> --delegated`, or `<id> --pr --delegated` when slices land through pull requests. It claims, builds, reviews, and runs the CI jobs locally; it reports the branch and the commit SHA. With `--pr`, it pushes, opens the PR and waits for the checks instead. It never merges. For a change too small for the `implement` cycle, use a named agent instead — `trobanga-skills:tdd-implementer-<effort>` for a test-first build — and its definition carries the standing rules, so the brief carries only the scope.
- **Agent reuse.** Spec work is largely sequential, and a fresh context per slice pays the code-reading cost again. When a slice builds directly on the previous one and touches the same code, send it with `SendMessage` to the agent that built the previous slice, so its context carries over. Start a fresh agent when the slices are independent, can run in parallel, or need a different model.
- **Model and effort**, by the next section.

Name the agent, model, and effort in the one-line record of the call.

## Pick the model

Use the cheapest model and effort that gets the slice done. That is a fit judgement, not a floor: a mechanical slice goes to the cheapest tier at low effort, and a slice where a wrong design is expensive goes to the best model at the highest effort. Both are correct when they match the slice.

- Judge the cost per completed slice, not per request. A cheap model that needs fixup rounds and a takeover costs more than the next tier landing first time. Pick the cheapest tier you expect to land first time.
- Signals for a cheap tier: the spec pins the design, the change is local, the acceptance criteria are mechanical to check, and the tests already exist or are obvious.
- Signals for a top tier: the slice makes design choices, cuts across modules, touches auth or data integrity, or has failed once already.
- When a delegated slice fails a fixup round, escalate one tier before the next round. The two-round limit below still applies.

## Briefs

Each brief is self-contained: goal, exact files, the project's hard rules, the relevant spec sections pasted in (pasting controls scope and removes any dependency on tracker access), the user decisions that bear on the slice, and acceptance criteria. Acceptance criteria are the whole verification instruction; the implementer checks its own work.

A brief adds context to a skill; it never overrides one. Do not tell a subagent to skip a step of a skill, to ignore or work around the user, or to turn off the sandbox or approvals. When a skill does not fit the slice as written, pick the other shape or ask the user. State environment needs as facts — "Postgres runs on localhost:5432; the sandbox blocks it" — and leave each command's handling to the subagent and its permission checks.

The auto-mode classifier reviews every delegation: the brief before the start, each action of the agent, and its final report. Briefs that override a skill's user checks were denied about half the time; plain briefs rarely are.

## Delegation rules

- Use `isolation: "worktree"` for every `/implement --delegated` agent, and for any other two agents that mutate files at the same time.
- For fixups on a delivered slice, `SendMessage` the same agent (a deferred tool: load it with `ToolSearch(query: "select:SendMessage")`) — its context is the asset. If the slice is still wrong after two fixup rounds, start a fresh agent one tier higher with a brief that names what went wrong; a third round on the same agent context is throwing good tokens after bad. If that agent fails too, stop the slice and report it.
- You review every diff yourself, and send every defect back to an agent.
- **If a delegation is denied**, do not rephrase the brief and launch it again: the classifier treats that as working around it. Stop that slice, tell the user what was denied, and let them start it again. Continue with the slices that do not depend on it.

## Merge

Merge as the user chose in setup step 4, in dependency order. In every mode, merge only the commit you reviewed.

**Direct merge.** The slice's agent reports a branch and a commit SHA; its local CI jobs are the only checks. When you reviewed the diff of that SHA against the default branch, fast-forward the default branch to it from the main checkout:

```bash
git push origin "$REVIEWED_SHA:refs/heads/$DEFAULT_BRANCH"
```

The worktrees share the object store, so the SHA is reachable without changing directory. Without force, git accepts only a fast-forward. If the push is rejected because the default branch moved (another slice landed), `SendMessage` the slice's agent to rebase and run its CI jobs again, review the new diff, and push its new SHA. After the push, run the T5 command of the tracker when T5 does not close through the commit message. Slices that build on each other run in sequence: start the next one only after the previous one landed, so its worktree starts from it.

**Pull requests.** Only when the user allowed you to merge. Merge a slice's PR when its checks are green (F5), you reviewed its diff, and its head is the commit you reviewed. Merge with F6 of the forge adapter. After each merge, have every open PR that builds on it rebased onto the default branch and checked again before you merge it. Without merge permission, a green PR is done for this run, and the user merges.

When a merge is blocked — a protection rule, a required review, a conflict, a red check — stop that slice and report it. Never force a push, never pass `--admin`, and never weaken a check to get a merge through.

## Final check

Before closing the run, review the combined work. You may run the review yourself or delegate it to a subagent; state which, and why, in one line. A check that applies its own fixes (`Skill(simplify)`, `code-review --fix`) edits code, so it runs inside a subagent, never in your loop. Pick the checks that match the run's risk:

- `Skill(trobanga-skills:conformance-review)` — documented standards and spec compliance side by side; the spec axis is the default check for a locked-spec run.
- `Skill(code-review)` — correctness bugs and cleanups; pick the effort level to match the risk of the change. The two skills do not overlap: conformance-review owns the written references, code-review owns everything without one.
- `Skill(security-review)` — when the run touched auth, input handling, secrets, or anything network-facing.
- `Skill(simplify)` — optional polish pass; it applies its fixes, so run it before the final quality gates.
- `Skill(trobanga-skills:patch-coverage)` — when you want a coverage number for the branch before closing.

Send each finding to the agent of the slice it belongs to, and have it fixed before closing. When you merge, run the final check before the last merge, so a finding still lands in a slice's commit or PR. A finding in a slice that already landed goes to a new slice, through the same review and merge.

## Closing

A slice is done when its tests pass, its docs edit has shipped, and its commit is on the default branch — or, with pull requests and without merge permission, its PR is green and handed to the user. Its issue closes through the T5 reference on merge, or through the T5 command you run after it. The run is done when every filed slice is done and the epic (or spec issue) is updated.

End with a short run summary: what shipped (outcome per slice, PR, deviations, open follow-ups) and how the run was orchestrated — per slice: the agent, model, effort, whether it reused an earlier agent, fixup rounds, and any denial. The per-slice one-line decision records are the raw material; this is their roll-up. Show it to the user, and post it on the epic (or spec issue) only if the user said yes in setup.
