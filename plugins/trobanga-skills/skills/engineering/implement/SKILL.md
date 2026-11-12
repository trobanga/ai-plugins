---
name: implement
description: Work on a tracked issue in a fresh git worktree based on the default branch. Claims the issue, creates the worktree, explores, designs, implements test-first, drives the CRAP score down, kills surviving mutants, reviews, runs the CI jobs locally, and merges the one commit into the default branch by fast-forward — or, with --pr, opens a PR that closes the issue. Works with GitHub, Linear or beads. Use when the user asks to start, pick up, implement, or work on an issue ("work on #123", "implement GIAM-45", "take bd-12", "start on that issue").
argument-hint: "<issue-id> [--pr] [--delegated]"
---

# Implement a Tracked Issue in a New Worktree

`${CLAUDE_SKILL_DIR}` stands for the directory of this file. If the harness does not expand it, replace it with the absolute path of that directory.

The issue id comes from the skill arguments. If the user gives no id, ask for one — unless
the tracker is `none`, where the arguments or the conversation describe the work.

**Ship mode.** Without `--pr`, the skill merges the work into the default branch itself
(**direct merge**, Phase 5A). No pull request opens and no remote CI runs, so the CI jobs run
locally instead. With `--pr`, the skill opens a pull request and does not merge (Phase 5B).
If the user asks for a pull request in words, that counts as `--pr`.

This skill is tracker-agnostic. Everything tracker-specific lives in an **adapter** file that
you read in Phase 0. The phases below never name a tracker.

---

## Phase 0 — Resolve tracker, forge and branch format

Resolve TRACKER, FORGE and the branch format by
[references/resolve-config.md](references/resolve-config.md). Done when all three are known —
from the config, from a guess you stated, or from the user's answer.

**Read the two adapter files** for the resolved axes before Phase 1:

- `references/trackers/{TRACKER}.md`
- `references/forges/{FORGE}.md`

The tracker adapter defines seven operations; this skill uses **T1**–**T5** (T6 and T7, create issue and link blocking, serve the skills that file issues):

| | Operation |
|---|---|
| T1 | Fetch the issue: title, body, state, discussion, assignee or status |
| T2 | Detect existing work: linked pull requests or branches |
| T3 | Claim the issue |
| T4 | Give the branch id: the identifier as it appears in a branch name |
| T5 | Close reference: the text or command that closes the issue when the work merges |

The forge adapter defines six; this skill uses **F1** in both ship modes, and **F2**–**F4**,
plus **F5** in delegated mode, only with `--pr` (F6, merge a pull request, serves
`orchestrate`):

| | Operation |
|---|---|
| F1 | Determine the default branch |
| F2 | Push the branch |
| F3 | Open the pull request, carrying T5 |
| F4 | Review the pull request |
| F5 | Wait for the checks |

The direct merge needs no forge operation beyond F1: it is plain git, the same on every forge.

> **Tools.** This skill declares no `allowed-tools`. A tracker reached over MCP (Linear) needs
> tool names that are not known when this file is written, and a closed list would block them.

> **Progress bar.** If the `trobanga-progress` mod is installed, report each phase to it. Load
> the tool once with `ToolSearch(query: "select:mcp__trobanga-progress__progress")`. If the
> tool does not exist, skip every progress call; the workflow does not depend on it. Call it:
> - in step 3, with `title` (the issue id and a few words) and `phase: "setup"`;
> - when a step below names a phase, with that `phase` (`explore`, `design`, `implement`,
>   `simplify`, `crap`, `mutants`, `review`, `ship`), also when the step is skipped;
> - in step 14, once you chose the agents, with `tasks`: one entry per agent you will launch,
>   its `title` equal to the Agent `description`, its `agent` the type without the plugin prefix;
> - at the end, with `finished: true`, also when the work stops early.

### Delegated mode

A caller such as `orchestrate` can run this skill in a subagent, with `--delegated` after the
issue id (and `--pr` when the caller wants pull requests). You cannot reach the user then; the
caller's brief carries the context and the decisions the user made. Every phase runs, with
these changes:

- **No progress bar.** The caller owns it.
- **A question to the user becomes a stop.** Wherever a step below asks the user (an existing
  PR, a claim by someone else, an existing worktree or branch, a failed claim), stop and make
  the situation your final report. Do not choose for the user.
- **The worktree is your cwd.** The caller launches you with `isolation: "worktree"`. Check
  that `git rev-parse --git-dir` differs from `git rev-parse --git-common-dir`; if not, stop
  and report. Skip steps 6–9: after step 5, run
  `git checkout --no-track -B "$BRANCH" "origin/$DEFAULT_BRANCH"` in the cwd. Do not call
  `EnterWorktree` or `ExitWorktree`.
- **Design without plan mode.** In step 13, take the design from the brief. Decide what the
  brief leaves open from the issue and the codebase, and list each such decision under
  Assumptions in the commit body (direct merge) or the PR body (`--pr`). If an open question
  would change the work materially, stop before step 14 and report it.
- **Nested agents run in the foreground.** Each brief you write names the worktree's absolute
  path and tells the agent to work only there.
- **Never merge.** The caller reviews the work before it lands, so it merges.
  - Direct merge: stop after step 21. Do not push anything. Steps 22 and 23 belong to the
    caller.
  - `--pr`: after step 25, run **F5**. If a check fails, fix it, amend the one commit, push
    with `--force-with-lease`, and run F5 again. After two failed rounds, stop and report.
    Skip step 26: F4 posts on the PR, and the caller decides about it.
- **Rebase on request.** If the caller sends a message that the default branch moved, run
  steps 20 and 21 again, and report the new SHA.
- **Final report:** the branch and the commit SHA (direct merge), or the PR number and URL
  and the state of the checks (`--pr`); the verbatim commit message, the assumptions, the
  CRAP and mutation results, the CI jobs you ran and skipped, the steps you skipped, and
  anything open.

---

## Phase 1 — Read the issue

Run **T1**. Do not continue until you have the issue. Use it as the source of truth and do not
re-fetch.

Read the discussion carefully. Requirements are frequently refined in comments rather than in
the original body.

If T1 errors, handle it per **Error Handling** below.

---

## Phase 2 — Check for existing work, claim, set up the worktree

1. **Stop if the issue already has a pull request.** This runs *first* — before claiming,
   before creating anything. Run **T2**.

   - **Any linked PR is open** (draft included) — **stop.** Report the PR number, title, URL
     and branch, and point the user at it. Do not claim, do not create a worktree, do not open
     a second PR. If they want to keep working on it, the existing branch is where that
     happens.
   - **All linked PRs are merged or closed** — the work may have been reverted or the issue
     reopened. Report them and ask whether to start fresh work before continuing.
   - **A weaker match** (a PR that mentions the id without a closing reference) — surface it
     and confirm before proceeding, rather than stopping outright.

2. **Claim the issue.** Only once step 1 has cleared. Run **T3**.

   If the issue is already claimed by someone else, do **not** claim it. Surface it and ask
   whether to proceed anyway.

   Claim before creating the worktree, so the issue is visibly taken while work is in flight.

3. **Establish repo context:**
   ```bash
   git rev-parse --show-toplevel
   ```
   Store this as `MAIN_REPO`. Every command in Phase 2 runs from here.

4. **Determine the default branch** with **F1**, then fetch it:
   ```bash
   git fetch origin "$DEFAULT_BRANCH"
   ```

5. **Derive the branch name** from the branch id (**T4**) and the issue title. Run
   [scripts/branch_name.py](scripts/branch_name.py); it prints the branch name, or on stderr
   what to fix:
   ```bash
   BRANCH="$(python3 "${CLAUDE_SKILL_DIR}/scripts/branch_name.py" build \
     --id "$BRANCH_ID" --title "$TITLE" --format "$BRANCH_FORMAT")"
   ```
   The `worktree-cleanup` skill parses the name back with the same script.

6. **Check whether this issue already has a worktree:**
   ```bash
   git worktree list --porcelain | grep -F "branch refs/heads/$BRANCH"
   ```
   If it exists, tell the user and ask whether to resume in it (skip to step 9) or start fresh.

7. **Create the worktree** off the freshly-fetched default branch. It must live under
   `.claude/worktrees/` — the harness pre-approves `EnterWorktree` for that directory only;
   any other location triggers a permission-root relocation prompt on every run:
   ```bash
   mkdir -p "$MAIN_REPO/.claude/worktrees"
   git worktree add -b "$BRANCH" ".claude/worktrees/$BRANCH" "origin/$DEFAULT_BRANCH"
   ```

8. **Carry local-only config into the worktree.** `.claude/` mixes tracked files (agents,
   commands, skills — these come across automatically) with untracked ones (`settings.json`,
   `settings.local.json`) that carry hooks and permissions. Only the untracked ones need
   copying. `.mcp.json` is usually tracked, but copy it when it is not — a Linear tracker is
   unreachable from the worktree without it. The same holds for an untracked
   `.agents/issue-tracker.local.md`:
   ```bash
   WORKTREE="$MAIN_REPO/.claude/worktrees/$BRANCH"
   for f in .claude/settings.json .claude/settings.local.json .agents/issue-tracker.local.md .mcp.json; do
     if [ -f "$MAIN_REPO/$f" ] && ! git ls-files --error-unmatch "$MAIN_REPO/$f" >/dev/null 2>&1; then
       mkdir -p "$WORKTREE/$(dirname "$f")"
       cp "$MAIN_REPO/$f" "$WORKTREE/$f"
       echo "Copied $f"
     fi
   done
   ```
   Then check whether `.claude/worktrees/` is ignored:
   ```bash
   git check-ignore -q .claude/worktrees/ && echo ignored || echo "NOT ignored"
   ```
   If not ignored, offer to add it to `.git/info/exclude` (local-only, leaves the repo clean).
   Only edit the tracked `.gitignore` if the user asks for it to be shared.

9. **Enter the worktree** so the session's working directory moves with the work:
   ```
   EnterWorktree(path: "<absolute path to .claude/worktrees/$BRANCH>")
   ```
   This is required, not cosmetic — it makes every later `git` call run in the worktree's own
   cwd. Passing `-C` or `cd`-ing instead triggers git's bare-repo sandbox protection and
   prompts on every command. The path must stay under `.claude/worktrees/`; other locations
   trigger a permission-root relocation prompt.

   Report the worktree path, branch and base commit. Do **not** call `ExitWorktree` at the
   end; `worktree-cleanup` owns removal.

10. **Bootstrap the environment.** A fresh worktree has no build artifacts or local env files.
    Check what the project needs (`node_modules`, `target/`, `.env`, `.envrc`, `venv`) and
    install or copy as appropriate before assuming anything builds. Done when the brief's
    test command (step 14) runs on the untouched base.

---

## Phase 3 — Understand and design

11. **Explore** (phase `explore`), scaling the effort to the issue. A typo fix needs no agents; a feature does.
    For non-trivial issues, launch `feature-dev:code-explorer` agents in parallel to map:
    - Similar existing features and the patterns they follow
    - Architecture and abstractions the issue touches
    - Test layout and extension points

    Then read the key files they identify yourself — do not design off summaries alone.

12. **Design** (phase `design`). For issues with more than one plausible approach, launch 2–3
    `feature-dev:code-architect` agents in parallel with `model: "opus"`, compare their
    blueprints, and form a single recommendation with the trade-offs made explicit. The
    `model` override is needed because the agent's own frontmatter pins it to Sonnet.

13. **Resolve ambiguities.** If there are clarifying questions, unresolved ambiguities, or
    multiple viable approaches:
    - `EnterPlanMode` to present the plan and open questions
    - `AskUserQuestion` for anything selectable, so the user picks instead of typing
    - `ExitPlanMode` once approved

    Skip plan mode only when the issue has a single obvious approach and no open questions —
    state the plan in a sentence or two and continue.

    Either way, the plan names the public interface changes and the ordered list of behaviors
    to test. This is the planning step of the `tdd` skill, done here with the user,
    because the implementer in step 14 cannot ask the user anything.

---

## Phase 4 — Implement

14. **Implement test-first on Sonnet** (phase `implement`). Delegate the red-green-refactor loop to a
    `trobanga-skills:tdd-implementer-<effort>` agent. It runs on Sonnet and invokes
    the `tdd` skill in delegated mode. You keep the design, the verification and
    the commit.

    **Write the brief.** The agent starts with no context, so the brief is self-contained:
    - The issue id and a two-line summary of the goal.
    - The approved design from step 13, including the decisions the user made.
    - The public interface changes, with signatures.
    - The ordered list of behaviors to test.
    - The files to change, and an existing test or module to copy the style from.
    - The command that runs the tests.
    - What is out of scope.

    **Choose the effort.** Pick the lowest level you expect to succeed on the first run. A
    failed run and a second run cost more than one run at the next level.

    | Effort | Use it when |
    |---|---|
    | `low` | Mechanical change: one or two files, an existing pattern to copy, every behavior fully specified. |
    | `medium` | Default. Several files, established patterns, no subtle logic. |
    | `high` | Subtle logic: concurrency, parsing, numerics, security, state across modules, unclear existing code. Also a retry after a failed `medium` run. |

    State the choice in one line, for example "Implementation: tdd-implementer-medium —
    three files, existing handler pattern". If the design itself is still in doubt, do not
    raise the effort; go back to step 13.

    **Report the plan** to the progress bar (see **Progress bar** above) with `tasks`: the
    implementer, then `crap-agent` and `mutant-agent` when their steps will run.

    **Launch** the agent in the foreground, because step 15 needs its result:
    ```
    Agent(subagent_type: "trobanga-skills:tdd-implementer-<effort>", prompt: <brief>)
    ```

    **Verify the result yourself.** Do not trust the report. Read the diff and check it
    against the brief and the codebase's existing conventions. Run the tests. Check that the
    tests assert behavior through the public interface, per the `tdd` skill.

    **If the agent is blocked or the result is wrong:**
    - Blocked on a design question: resolve it (ask the user if needed), then continue the
      same agent with `SendMessage`, so it keeps its context.
    - Wrong or incomplete work: send the specific defects with `SendMessage`. If a second
      round does not fix them, run a new agent one effort level higher.
    - A `high` run fails: take over in this session and finish the loop with
      the `tdd` skill yourself. Report that you did.

15. **Simplify** (phase `simplify`) with `/simplify`, which reviews the changed code for reuse, simplification,
    efficiency and altitude and applies the fixes. It does not hunt for bugs — step 18 does.

    **This step is conditional.** `/simplify` launches four review agents, so skip it when the
    non-test diff against the default branch is small — roughly under 50 changed lines. Report
    one line — "Simplify step skipped: small diff" — and continue.

    `/simplify` edits code that already passed its tests. When it finishes, run the test suite
    again. If a test fails, revert the `/simplify` edit that broke it rather than patching
    around it.

16. **Drive the CRAP score down** (phase `crap`) with the `trobanga-skills:crap-agent` agent. It measures
    every function changed against the default branch and brings each one below the threshold
    by adding tests or extracting functions. Name the base `origin/$DEFAULT_BRANCH` in its
    brief.

    **This step is conditional.** The agent supports Java, Go, Rust, TypeScript, JavaScript
    and Elixir, and needs a working coverage build. Detect the language from the build file
    (`pom.xml`, `go.mod`, `Cargo.toml`, `mix.exs`, `package.json`). If none matches, or the
    coverage build fails, report one line — "CRAP step skipped: no supported build file" —
    and continue. Do not block shipping on it.

    It runs before the review, not after, so the reviewers see the tests it wrote and the
    functions it extracted.

17. **Kill surviving mutants** (phase `mutants`) with the `trobanga-skills:mutant-agent` agent. It runs the
    project's own mutation tool on the code the branch changes, and adds a test for each
    mutant that survives and that a test can catch. Name the base `origin/$DEFAULT_BRANCH`
    in its brief.

    **This step is conditional.** The agent first checks whether the project does mutation
    testing (its `CLAUDE.md`, task runner, CI or tool configuration). If it does not, the
    agent reports one line — "Mutation step skipped: the project does not do mutation
    testing" — and you continue. A mutant the agent leaves alive does not block shipping:
    carry its reason into the commit message (direct merge) or the PR body (`--pr`), so a
    reader can judge it.

    It runs after the CRAP step, because the tests that step adds already kill some mutants,
    and before the review, so the reviewers see the tests it wrote.

18. **Review** (phase `review`) the final diff. Launch `feature-dev:code-reviewer` agents in parallel, each
    with one focus:
    - Bugs and functional correctness
    - Project conventions and existing abstractions
    - Test coverage and edge cases

    Present findings; fix high-severity issues. These agents are read-only — they report, you
    edit. This is the single full review pass of the workflow; its value comes from the
    reviewers' fresh context, so do not skip it just because the code looks done.

---

## Phase 5 — Ship

> **One commit per issue.** The branch carries exactly one commit. If an earlier phase (for
> example the TDD loop) made more than one, squash them into one before you push. Every later
> fix — from a reviewer agent, from a local CI job, from **F4**, or from any other part of the
> workflow — amends that commit. Do not add a fix as an extra commit.

Without `--pr`, follow Phase 5A. With `--pr`, follow Phase 5B.

### Phase 5A — Direct merge (default)

19. **Commit** (phase `ship`) with the `commit-commands:commit` skill, passing `--signoff`. If
    that skill does not exist, run `git commit --signoff` with a message in the style of
    `git log`. If the branch already has commits, squash them into one first:
    `git reset --soft "$(git merge-base HEAD "origin/$DEFAULT_BRANCH")"`. The commit message
    carries what a PR body would carry: the **T5** close reference, the Assumptions, and the
    reason for each mutant that survived.

20. **Rebase onto the current default branch:**
    ```bash
    git fetch origin "$DEFAULT_BRANCH"
    git rebase "origin/$DEFAULT_BRANCH"
    ```
    With no remote, rebase onto the local default branch instead. If the rebase conflicts,
    resolve the conflict and amend it into the commit. If the resolution is not obvious from
    both sides' intent, ask the user.

21. **Run the CI jobs locally.** No remote CI runs on a direct merge, so this step is the merge
    gate. Run it on the rebased commit, also when step 20 changed nothing.
    - Find the CI configuration: `.github/workflows/`, `.forgejo/workflows/`, `.gitlab-ci.yml`,
      `.circleci/config.yml`, `.woodpecker.yml`, `Jenkinsfile`.
    - For each job that runs on a push or a pull request to the default branch, run its
      commands in the worktree, in the order the jobs depend on each other. Skip the setup
      actions (`uses: actions/setup-*`); the local toolchain stands in for them. If the local
      version differs from the one the job pins, say so. Of a build matrix, run the entry that
      matches this machine.
    - Skip a job that deploys, publishes or releases, needs a secret, or needs a service or a
      platform that this machine lacks. List each skipped job with its reason.
    - If the project has no CI configuration, run the full test suite and the lint and format
      checks that the project documents (`CLAUDE.md`, `README`, task runner).

    If a job fails, fix the cause, amend the commit, and run all jobs again, because a fix can
    break another job. If the same job fails after two fixes, stop and ask the user. Done when
    every job you did not skip passes on the rebased commit.

22. **Fast-forward the default branch** to the commit:
    ```bash
    git push origin "HEAD:refs/heads/$DEFAULT_BRANCH"
    ```
    Without force, git accepts only a fast-forward, so nothing on the default branch is lost.
    Do not push the issue branch itself.
    - **Rejected because the default branch moved** (`non-fast-forward`, `fetch first`): run
      steps 20–22 again. After two such rounds, stop and report.
    - **Rejected by a protection rule or a hook:** stop. Never force, and never bypass the rule.
      Report the rejection, and offer to ship the same commit with `--pr`.
    - **No remote:** you cannot update a branch that is checked out in `MAIN_REPO`. Report the
      command for the user to run there: `git merge --ff-only "$BRANCH"`.

23. **Close the issue and report.**
    - If T5 closes through the commit message (GitHub `Closes #N`), the push closed the issue.
      Confirm with **T1**. Otherwise run the T5 command now.
    - Print the commit text verbatim, in a fenced block:
      `git log -1 --format='%H%n%B' HEAD`.
    - Report the SHA that is now on the default branch, the CI jobs you ran and skipped, and
      that no remote CI and no PR review happened: step 18 was the only review.
    - The default branch in `MAIN_REPO` is now behind `origin`. Tell the user to run
      `git pull --ff-only` there. Do not run it yourself; that checkout is the user's.

    Then report `finished: true` to the progress bar.

### Phase 5B — Pull request (`--pr`)

24. **Commit, push and open the pull request** (phase `ship`) per **F2** and **F3**, passing `--signoff`
    (required for all commits in this environment). The PR body must carry the **T5** close
    reference.

    When T5 is not a PR-body reference — a tracker that closes through its own API — open the
    PR with a plain reference to the issue id, and run the T5 command after the PR merges.
    Tell the user that closing is a separate step in that case.

    **Capture the PR number** from the output — the next steps need it.

    **Show the commit text.** After the PR opens, print the full message — subject, body and
    trailers — of every commit the PR carries, verbatim, in a fenced block:

    ```
    git log --format='%H%n%B' origin/<default-branch>..HEAD
    ```

    Normally this is the one commit. If it lists more than one, the squash above was missed —
    say so.

    Then report `finished: true` to the progress bar.

25. **Assign the PR to yourself** per the forge adapter. If assignment fails (for example the
    PR was opened from a fork, where the author may not be assignable), report it and
    continue — it is not worth blocking the review on.

26. **Review the pull request** with **F4** — **only for large or risky changes** (wide diffs,
    migrations, auth or security-relevant code, data handling). The full review already ran in
    step 18; for routine changes, skip this and finish. If it runs and finds high-severity
    issues, fix them:
    - Amend the fix into the single commit with `git commit --amend --signoff`. Never add a
      follow-up commit.
    - Push with `--force-with-lease`, never `--force`.
    - Re-request review after pushing fixes.

---

## Error Handling

- **Tracker cannot be resolved** — ask the user, and offer the `setup-project` skill.
- **Tracker tool missing or unauthenticated** — report it and stop. The adapter names the
  check command for its tracker.
- **Not a git repository** — stop; this skill has nothing to operate on.
- **The id is a pull request, not an issue** — say so and stop.
- **Issue is already closed** — report its state and confirm before proceeding.
- **Issue has an open linked PR** — hard stop (Phase 2, step 1). Report the PR and exit
  without claiming, creating a worktree, or opening a second PR. One issue, one PR.
- **Issue has only merged or closed linked PRs** — report them and confirm before starting
  fresh work; the issue may have been reopened after a revert.
- **Issue claimed by someone else** — surface this before starting work, so the user does not
  duplicate effort. Do not claim it unless the user confirms.
- **Claiming fails** — usually a permissions problem. Report it and ask whether to continue
  unclaimed rather than stopping outright.
- **Multiple remotes or ambiguous repo** — the forge adapter names the explicit-repo flag.
- **Branch already exists** — offer: resume on it, pick a different name, or delete the
  existing worktree first (`worktree-cleanup` handles removal safely).
- **Push to the default branch rejected by a protection rule** — stop (Phase 5A, step 22).
  Never force or bypass it. Offer to ship the same commit with `--pr`.

## Notes

- Each issue gets an isolated environment based on a freshly-fetched default branch, leaving
  the main working directory untouched.
- The worktree location (`.claude/worktrees/`) is a shared contract with
  the `worktree-cleanup` skill. Changing it here requires changing it there too.
  The location is also a harness contract: `EnterWorktree` is pre-approved only for paths
  under `.claude/worktrees/`.
- The issue (and with `--pr`, the PR) ends up claimed by you, so in-flight work is visible
  without manual bookkeeping.
- A direct merge leaves the issue branch as an ancestor of the default branch, so
  `worktree-cleanup` sees it as merged.
