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

The deploy jobs in `quality-gate.yml` opt in with `environment: production`.
`notify-deploy-pending` only sends a Telegram message pointing at the run; it
cannot block anything.

This replaced a job that polled `/tmp/pexsec-gates` for 30 minutes while holding
a runner slot. On 2026-07-30 that window expired unseen and cancelled a deploy —
a merged migration never reached the database and the only trace was a failed
job.

### Reviewer

`REVIEWER_ID` is a numeric user id rather than a login, because the API takes ids
and a login rename would silently break the rule instead of erroring.

Override any of it via environment variables:

```bash
REPO=owner/repo BRANCH=main REVIEWER_ID=123456 ./ops/apply-repo-settings.sh
```
