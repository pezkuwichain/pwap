# ops

Operational configuration that lives outside the application code.

## `apply-repo-settings.sh`

The repository's GitHub protections, as code.

Branch protection and the `production` environment are configured through the
GitHub API. Nothing in the repository reflects them, so by default they are
invisible here, unversioned, and gone without a trace if someone removes them —
which undercuts the point, since both exist precisely so that nothing reaches
`main` or production unreviewed.

```bash
./ops/apply-repo-settings.sh          # apply the desired state
./ops/apply-repo-settings.sh --check  # report drift, change nothing
```

Idempotent: each call PUTs the full desired state, so repeated runs converge.
Requires `gh` authenticated with admin rights on the repo.

### What it enforces

**Branch protection on `main`**

| setting | value | why |
|---|---|---|
| required check | `CI Gate ✅` | aggregate job — fails if web, backend or security-audit did not succeed |
| strict | true | branch must be up to date with `main` before merging |
| approvals | 1 | no unreviewed code on `main` |
| dismiss stale reviews | true | an approval does not carry over to new commits |
| force pushes | blocked | history cannot be rewritten |
| deletions | blocked | `main` cannot be deleted |
| conversation resolution | required | review comments cannot be merged past |

Only `CI Gate ✅` is listed as a required check, deliberately. It runs with
`if: always()` and inspects the results of the jobs it needs, so it already
covers them. Listing each job here as well would mean editing this file whenever
one is renamed — and a rename would then quietly drop a requirement instead of
failing loudly.

`enforce_admins` stays `false` on purpose: an admin needs a way through during a
real incident. It is an escape hatch, not the normal path — rare, visible, and
recorded in the branch's protection history.

**`production` environment**

Deployment approval is an environment protection rule, not something the workflow
implements. GitHub holds the run until a reviewer approves it:

- no runner is occupied while waiting
- the window is 30 days, so a missed notification costs nothing
- who approved which SHA is recorded in the deployment history
- approval state survives a runner restart

Exactly one job in `quality-gate.yml` opts in with `environment: production`:
`approve-deploy`. The four deploy jobs are held by depending on it.
`notify-deploy-pending` only sends a Telegram message pointing at the run; it
cannot block anything.

This replaced a job that polled `/tmp/pexsec-gates` for 30 minutes while holding
a runner slot. On 2026-07-30 that window expired unseen and cancelled a deploy —
a merged migration never reached the database and the only trace was a failed
job.

### Why one gate job and not `environment:` on each deploy

The first version put `environment: production` on all four deploy jobs, which
reads as the more direct design — GitHub itself holds each one. It does not
behave that way.

GitHub opens an approval request for the jobs that are *eligible at that moment*,
and these four never are. `deploy-supabase` waits only on the notification;
the rest wait on image builds that take minutes. So a run asks twice. On
2026-07-31 the first approval shipped the Supabase functions and migrations, and
the run then went back to waiting — unnoticed, because the notification had
already been sent and answered. The schema had moved and the app serving it had
not. Nobody is told about the second round; you have to be looking at the run.

One gate job removes the split by construction: everything that deploys hangs off
a single approval, so there is only ever one to give.

The cost is that approval is now enforced by a dependency edge rather than by
GitHub. `ops/check-deploy-gate.py` restores the guarantee — it fails CI if a
`deploy-*` job does not depend on `approve-deploy`, if a second job declares the
environment (which brings the split back), or if a job uses `always()` without
asserting the gate succeeded, which silently un-holds it. The `Deploy gate
wiring` job runs it on every PR.

```bash
python3 ops/check-deploy-gate.py
```

### Known: the version bump lands before approval

`bump-version` commits `web/package.json` to `main` and pushes it before the gate
— so rejecting a deploy leaves a bumped version for a release that never shipped.
It is a number in a file, `[skip ci]`, and touches no server. Left as is rather
than changed quietly; moving it behind `approve-deploy` is a one-line change if
that is preferred.

### Stopping a run that is waiting for approval

`gh run cancel` does not work on a run held at an environment gate — it reports
success and the run stays `waiting`, still holding the queue behind it. The
pending deployment has to be **rejected**:

```bash
gh api repos/:owner/:repo/actions/runs/<RUN_ID>/pending_deployments \
  -X POST -f state=rejected -f comment='superseded' \
  -F 'environment_ids[]=<ENV_ID>'
```

Get `<ENV_ID>` from `gh api repos/:owner/:repo/actions/runs/<RUN_ID>/pending_deployments`.
This came up on 2026-07-31: a stale run sat in `waiting` and blocked the deploy
of the run behind it until it was rejected.

### Reviewer

`REVIEWER_ID` is a numeric user id rather than a login, because the API takes ids
and a login rename would silently break the rule instead of erroring.

Override any of it via environment variables:

```bash
REPO=owner/repo BRANCH=main REVIEWER_ID=123456 ./ops/apply-repo-settings.sh
```
