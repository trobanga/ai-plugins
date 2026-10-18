#!/usr/bin/env bash
# A small Python CLI in plain git, tracker `none`, forge `none`, with a finished
# feature in a worktree under .claude/worktrees/. `origin/main` moved on after the
# branch was cut, so the branch must be rebased before it can fast-forward.
# The CI workflow runs a docstring check that the feature commit fails: only a
# skill that runs the CI jobs locally finds it. `origin` is a bare repository in
# the run workspace, so nothing reaches the network.
# Runs in the empty run workspace (claude plugin eval --scaffold).
set -euo pipefail
export GIT_AUTHOR_NAME="Eval Dev" GIT_AUTHOR_EMAIL="dev@example.com"
export GIT_COMMITTER_NAME="Eval Dev" GIT_COMMITTER_EMAIL="dev@example.com"

git init -q -b main .
git config user.name "Eval Dev"
git config user.email "dev@example.com"

mkdir -p .agents .github/workflows scripts tests
cat > .agents/issue-tracker.md <<'EOF'
# Issue tracker

**Tracker: none.** The work is whatever the conversation describes.

**Forge: none.** Plain git. `origin` is a bare repository with no pull-request host.

Branch names are `{id}--{slug}`. No deviations from the adapters.
EOF

cat > .github/workflows/ci.yml <<'EOF'
name: ci
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: python3 -m unittest discover -s tests -t .
  docstrings:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: python3 scripts/check_docstrings.py
  deploy:
    runs-on: ubuntu-latest
    needs: [test, docstrings]
    steps:
      - run: ./deploy.sh
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
EOF

cat > scripts/check_docstrings.py <<'EOF'
"""Fail when a public function in greet.py has no docstring."""
import ast
import sys

tree = ast.parse(open("greet.py").read())
missing = [
    node.name
    for node in ast.walk(tree)
    if isinstance(node, ast.FunctionDef)
    and not node.name.startswith("_")
    and ast.get_docstring(node) is None
]
if missing:
    print("missing docstring: " + ", ".join(missing))
    sys.exit(1)
EOF

cat > greet.py <<'EOF'
"""Greet a person by name."""
import argparse
import os


def resolve_name(cli_name):
    """Return the name to greet."""
    return cli_name or os.environ.get("GREET_NAME") or "world"


def main(argv=None):
    """Run the CLI."""
    parser = argparse.ArgumentParser(prog="greet")
    parser.add_argument("name", nargs="?")
    args = parser.parse_args(argv)
    print(f"Hello, {resolve_name(args.name)}!")


if __name__ == "__main__":
    main()
EOF

cat > tests/__init__.py <<'EOF'
EOF
cat > tests/test_greet.py <<'EOF'
import unittest

from greet import resolve_name


class ResolveNameTest(unittest.TestCase):
    def test_cli_name_wins(self):
        self.assertEqual(resolve_name("Ada"), "Ada")
EOF

git add -A
git commit -q -m "Add greet CLI"

git clone -q --bare . .origin.git
echo ".origin.git/" >> .git/info/exclude
echo ".claude/worktrees/" >> .git/info/exclude
git remote add origin "$PWD/.origin.git"
git fetch -q origin
git remote set-head origin main
git branch -q -u origin/main main

# The finished feature, on its own branch in a worktree.
BRANCH="20261018--add-a-name-source-helper"
git worktree add -q -b "$BRANCH" ".claude/worktrees/$BRANCH" origin/main
(
  cd ".claude/worktrees/$BRANCH"
  cat >> greet.py <<'EOF'


def name_source(cli_name):
    if cli_name:
        return "argument"
    if os.environ.get("GREET_NAME"):
        return "environment"
    return "default"
EOF
  cat > tests/test_name_source.py <<'EOF'
import unittest

from greet import name_source


class NameSourceTest(unittest.TestCase):
    def test_argument(self):
        self.assertEqual(name_source("Ada"), "argument")

    def test_default(self):
        self.assertEqual(name_source(None), "default")
EOF
  git add -A
  git commit -q -s -m "Add a name source helper" -m "Report whether the name came from the argument, the environment or the default."
)

# Meanwhile, someone else pushed to main.
git clone -q .origin.git .other
(
  cd .other
  git config user.name "Other Dev"
  git config user.email "other@example.com"
  printf '# greet\n\nGreets a person by name.\n' > README.md
  git add README.md
  git commit -q -m "Add a README"
  git push -q origin main
)
rm -rf .other
