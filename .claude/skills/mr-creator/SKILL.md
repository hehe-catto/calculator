---
name: mr-creator
description: Creates a GitHub pull request (what many teams still call a 'merge request' or 'MR') from the current branch, writing the title and description by reading the actual commits and diff rather than asking the user to draft it. Use this whenever the user asks to open a PR/MR, "put this branch up for review", "push and create a pull request", or otherwise wants their local work turned into a reviewable PR — even if they don't mention GitHub or "pull request" by name. Also handles the case where there are a lot of uncommitted changes — before creating the PR, it cheaply groups the changed files and tells the user if the changes look like they should be split into more than one commit, so unrelated work doesn't land in a single commit or PR.
---

# MR Creator

Turns local changes (committed or not) into a well-described GitHub pull request, using the `gh` CLI. Two things this skill is deliberately careful about:

1. Don't blow the context budget reasoning about which files belong together. Git already gives you this information cheaply (`git status`, `git diff --numstat`) — there's rarely a need to read full file contents or full diffs just to decide how to group files into commits.
2. Never push or open a PR without showing the user what's about to be published. A pushed branch and an open PR are both visible to other people — draft first, confirm, then act.

## Step 0: Orient yourself

```bash
git rev-parse --is-inside-work-tree   # confirm we're in a repo
git remote -v                          # confirm it's a GitHub remote
git branch --show-current
gh auth status                         # confirm gh is installed and authenticated
```

If `gh auth status` fails (e.g. stale/invalid keyring token), check for a `GITHUB_TOKEN` in the environment before giving up — `gh` reads it automatically for API calls, so `GITHUB_TOKEN=$GITHUB_TOKEN gh auth status` (or simply re-running any `gh` command with that variable exported) is enough to confirm it works. Note `.zshrc` is only sourced in interactive shells, so a non-interactive session may need `source ~/.zshrc` first to pick it up.

If neither the stored `gh` auth nor `GITHUB_TOKEN` works, stop and tell the user — point them at `gh auth login` (or ask them to fix/export `GITHUB_TOKEN`). Don't try to work around this with raw API calls; that wasn't the point of this skill.

**Known issue — sandboxed sessions:** if `gh auth status` reports the token itself as invalid (`The token in GITHUB_TOKEN is invalid` / `x509: certificate` / TLS errors), don't take that at face value — verify the token directly first: `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user`. If that returns `200`, the token is fine and the real problem is that `github.com`/`api.github.com` isn't on the sandbox's network allowlist, so `gh`'s own TLS handshake fails and it misreports it as a bad token. In that case, run the rest of this skill's `git`/`gh` commands with the sandbox disabled for this repo rather than concluding auth is broken.

If the current branch is the repo's default branch (main/master), you need a feature branch before anything can be committed or opened as a PR. Look at `git status --porcelain` (and `git diff --stat` if the file list alone isn't descriptive enough) to see what's actually uncommitted, and propose a short kebab-case branch name based on that (e.g. `fix/retry-timeout`) — don't just ask the user to name it blind. Confirm the name with the user via `AskUserQuestion` before creating it, then:

```bash
git checkout -b <branch-name>
```

Uncommitted changes carry over onto the new branch automatically (checkout -b doesn't touch the working tree), so nothing needs to be staged, stashed, or moved for this step.

If instead you're already on a feature branch (not main/master), check whether it's already been merged — otherwise you risk adding new commits or opening a PR from a branch whose work already shipped:

```bash
git fetch origin main --quiet
git branch --merged origin/main
```

If `git fetch` fails (no network), skip this check and continue. If the current branch name doesn't appear in the merged list, continue normally — nothing to do here.

If the current branch **is** in the merged list, tell the user it's already merged into main, then do the following automatically:

```bash
git stash push -u -m "auto-stash: changes from merged branch <branch>"
git checkout main
git pull origin main
```

If the pull fails, show the error and stop — let the user resolve manually. Otherwise, propose a fresh branch name based on the stashed changes (`git stash show --name-only`), confirm with `AskUserQuestion`, then:

```bash
git checkout -b <branch-name>
git stash pop
```

If the pop fails due to conflicts, list the conflicting files and stop — let the user resolve them before continuing.

## Step 1: Deal with uncommitted changes first

If `git status --porcelain` is empty, skip to Step 2.

Otherwise, run the bundled script rather than reading diffs by hand:

```bash
python3 scripts/summarize_changes.py
```

This prints changed files grouped by directory, with per-file +/- line counts — no file content, so it's cheap regardless of how large the diffs are. Read the grouped output and use judgment, not a rigid rule:

- One group, or several small/related groups (e.g. a rename that touches many directories, or a feature and its tests) → this is fine as one commit. Say so briefly and move on.
- Multiple groups that look like separate concerns (different features, an unrelated fix mixed in with the main change, docs-only edits alongside logic changes) → recommend splitting, and say why for each group ("these payments files look unrelated to the auth changes — consider a separate commit"). Suggest a commit message per group.

Only look at the actual diff content for a file when the grouping is genuinely ambiguous from the path/stats alone (e.g. an oddly-named file, or a group whose "kind" mix is confusing) — and even then, use `git diff -- <path>` for that one file, not the whole tree.

The user has said they'll do the actual committing themselves — so present the recommendation and stop here. Don't run `git commit` for them. Wait for them to tell you the commits are ready before moving to Step 2.

## Step 2: Gather what the PR is actually about

Once the branch has the commits you're going to open a PR from:

```bash
BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
git log $BASE..HEAD --format='%s%n%b'      # commit messages — cheap, and usually the best summary source
git diff $BASE...HEAD --stat                # file-level overview
```

Use the commit messages as your primary source for the description — someone already summarized their own intent there. Use the diff stat to sanity-check scope and to notice anything the commit messages didn't mention. Only pull a full `git diff $BASE...HEAD -- <path>` for specific files if the commit messages don't explain what changed and the file is central to the change (e.g. the stat shows it as the largest hunk by far). Don't read the full diff of every file — for most PRs the commit log plus the stat is enough.

Check for a repo PR template before writing your own structure:

```bash
ls .github/PULL_REQUEST_TEMPLATE.md .github/pull_request_template.md .github/PULL_REQUEST_TEMPLATE/*.md 2>/dev/null
```

If one exists, fill it in. Otherwise use:

```markdown
## Summary
1-3 sentences on what this PR does and why.

## Changes
- Bullet per logical change (map roughly to the commit groups from Step 1, or to the commits themselves)

## Testing
How this was verified, or what a reviewer should check. If there's no evidence of tests run or added, say so plainly rather than inventing testing steps.
```

Keep the summary in your own words — don't just concatenate commit messages verbatim into the body.

## Step 3: Confirm before publishing anything

Show the user the draft title, body, base branch, and head branch. This is the point to catch a wrong base branch, a title that doesn't match what they actually meant, or a description that overstates what was tested. Wait for a go-ahead or edits.

Once confirmed:

```bash
git push -u origin $(git branch --show-current)   # only if the branch isn't already pushed
gh pr create --base "$BASE" --title "..." --body "..."
```

Report back the PR URL that `gh pr create` prints — that's the useful output, not a restatement of the description.

## Notes

- If the user asks for a draft PR, add `--draft` to the `gh pr create` call.
- If they mention a linked issue ("closes #123"), include a `Closes #123` line in the body — GitHub will auto-link and auto-close it on merge.
- If `gh pr create` fails because a PR already exists for the branch, that's `gh pr edit` territory — ask the user if they want to update the existing PR instead.
