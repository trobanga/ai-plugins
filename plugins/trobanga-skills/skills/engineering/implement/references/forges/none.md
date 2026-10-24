# Forge adapter: none (plain git)

For a repo with no pull-request host: a bare remote, a local-only repo, or a mirror where
review happens elsewhere.

F2–F6 apply to `implement --pr` only. Here `--pr` means: hand the branch over, and let the
user merge it. The default direct merge of `implement` (its Phase 5A) is plain git and needs
only F1.

## F1 — Default branch

```bash
DEFAULT_BRANCH="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD | sed 's|^origin/||')"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"
```

If the repo has no `origin`, ask the user for the base branch. Do not guess.

## F2 — Commit and push

Commit with the `commit-commands:commit` skill, passing `--signoff`. If that skill does not
exist, run `git commit --signoff` with a message in the style of `git log`.

Then push, if a remote exists:

```bash
git push -u origin "$BRANCH"
```

With no remote, the branch stays local. Say so — the work is not backed up anywhere.

## F3 — Pull request

There is none. Instead:

1. Report the branch name and the commit range to the user.
2. State how to merge it, and do not merge it yourself.
3. Run the tracker's T5 close operation only after the user confirms the merge.

## F4 — Review

There is no PR to review. The Review step of Phase 4 is the only review pass.
Say so explicitly, so the user knows no second pair of eyes is coming.

## F5 — Checks

There is no CI. The test suite run of Phase 4 is the only check. Say so.

## F6 — Merge

Do not merge. Report the branch and how to merge it, as in F3; the user merges.
