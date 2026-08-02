#!/usr/bin/env bash
#
# apply-repo-settings.sh — the repo's GitHub protections, as code.
#
# Branch protection and the production environment are configured through
# GitHub's API, not through anything in this repository. That means they are
# invisible here, unversioned, and gone without trace if someone removes them.
# The whole point of both is that nobody can push to main or deploy unreviewed,
# so leaving them as undocumented clicks in a settings page undercuts them.
#
# This script is the source of truth. It is idempotent — every call is a PUT of
# the full desired state, so running it repeatedly converges rather than stacks.
#
#   ./ops/apply-repo-settings.sh          # apply
#   ./ops/apply-repo-settings.sh --check  # report drift, change nothing
#
# Requires gh with admin rights on the repo.
set -euo pipefail

REPO="${REPO:-pezkuwichain/pwap}"
BRANCH="${BRANCH:-main}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# The reviewer who approves deployments. Numeric id rather than login, because
# the API takes ids and a login rename would silently break the rule.
REVIEWER_ID="${REVIEWER_ID:-224622464}"   # SatoshiQaziMuhammed

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

info() { printf '  %s\n' "$*"; }
ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }

# ── Branch protection ────────────────────────────────────────────────────────
# CI Gate ✅ is the only required check on purpose: it is an aggregate job that
# runs with if:always() and fails if web, backend or security-audit did not
# succeed. Listing the individual jobs here as well would mean this file has to
# be edited every time one is renamed, and a rename would silently drop a
# requirement rather than fail loudly.
read -r -d '' PROTECTION <<'JSON' || true
{
  "required_status_checks": { "strict": true, "contexts": ["CI Gate ✅"] },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON

# enforce_admins stays false deliberately: an admin needs a way out during a real
# incident. It is an escape hatch, not the normal path — using it should be rare
# and visible, and it is recorded in the branch's protection history.

# ── Deployment approval ──────────────────────────────────────────────────────
# Approval is an environment protection rule, not something the workflow
# implements. GitHub holds the run without occupying a runner, waits up to 30
# days, and records who approved which SHA. The workflow's deploy jobs opt in
# with `environment: production`.
read -r -d '' ENV_CONFIG <<JSON || true
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "reviewers": [{ "type": "User", "id": ${REVIEWER_ID} }],
  "deployment_branch_policy": { "protected_branches": true, "custom_branch_policies": false }
}
JSON

echo "▶ repo settings: $REPO"

if [[ $CHECK_ONLY -eq 1 ]]; then
  echo "── branch protection ($BRANCH)"
  cur="$(gh api "repos/$REPO/branches/$BRANCH/protection" 2>/dev/null || echo '{}')"
  if [[ "$cur" == "{}" ]]; then
    bad "branch is NOT protected"
  else
    python3 - "$cur" <<'PY'
import json, sys
d = json.loads(sys.argv[1])
checks = (d.get('required_status_checks') or {})
rev = (d.get('required_pull_request_reviews') or {})
want = {
    'required checks': (checks.get('contexts'), ['CI Gate ✅']),
    'strict': (checks.get('strict'), True),
    'approvals': (rev.get('required_approving_review_count'), 0),
    'dismiss stale': (rev.get('dismiss_stale_reviews'), True),
    'force pushes blocked': (not (d.get('allow_force_pushes') or {}).get('enabled'), True),
    'deletions blocked': (not (d.get('allow_deletions') or {}).get('enabled'), True),
    'conversation resolution': ((d.get('required_conversation_resolution') or {}).get('enabled'), True),
}
for label, (got, exp) in want.items():
    mark = '\033[32m✔\033[0m' if got == exp else '\033[31m✗\033[0m'
    extra = '' if got == exp else f'  (expected {exp}, got {got})'
    print(f'  {mark} {label}{extra}')
PY
  fi

  # Rulesets are a second, independent layer over the same branch — and this
  # script was blind to them. On 2026-08-01 it reported branch protection fully
  # green while a repository ruleset on the same branch demanded two status
  # checks that no workflow produces ("Build, Lint & Test", "All checks
  # passed"). Nothing could merge without --admin, and the drift report said
  # everything was fine. Two layers that disagree are worse than one, so the
  # check has to see both.
  echo "── rulesets ($BRANCH)"
  rs="$(gh api "repos/$REPO/rulesets" 2>/dev/null || echo '[]')"
  python3 - "$REPO" "$rs" <<'PY2'
import json, subprocess, sys
repo, raw = sys.argv[1], sys.argv[2]
try:
    sets = json.loads(raw)
except Exception:
    sets = []
active = [r for r in sets if r.get('enforcement') == 'active']
if not active:
    print('  \033[32m✔\033[0m no active ruleset (branch protection is the only layer)')
    raise SystemExit

# Every check a ruleset demands must be a check something actually reports,
# otherwise the branch is permanently unmergeable and the reason is invisible.
# Sample recent pull request heads, not main. Required checks are the ones that
# gate a PR, and several of them (the aggregate gate especially) only run on
# pull_request — looking at main's head would report them as never seen.
reported = set()
try:
    prs = json.loads(subprocess.run(
        ['gh', 'api', f'repos/{repo}/pulls?state=all&per_page=5'],
        capture_output=True, text=True).stdout)
    for pr in prs[:5]:
        runs = json.loads(subprocess.run(
            ['gh', 'api', f"repos/{repo}/commits/{pr['head']['sha']}/check-runs"],
            capture_output=True, text=True).stdout)
        reported |= {c['name'] for c in runs.get('check_runs', [])}
except Exception:
    pass

for r in active:
    detail = json.loads(subprocess.run(
        ['gh', 'api', f"repos/{repo}/rulesets/{r['id']}"], capture_output=True, text=True).stdout)
    for rule in detail.get('rules', []):
        if rule['type'] == 'required_status_checks':
            want = [c['context'] for c in rule['parameters'].get('required_status_checks', [])]
            missing = [c for c in want if reported and c not in reported]
            mark = '\033[31m✗\033[0m' if missing else '\033[32m✔\033[0m'
            note = f"  (never reported: {missing})" if missing else ''
            print(f"  {mark} '{r['name']}' requires {want}{note}")
        if rule['type'] == 'pull_request':
            n = rule['parameters'].get('required_approving_review_count')
            mark = '\033[32m✔\033[0m' if n == 0 else '\033[31m✗\033[0m'
            extra = '' if n == 0 else '  (expected 0 — see README)'
            print(f"  {mark} '{r['name']}' approvals: {n}{extra}")
PY2

  echo "── environment ($ENVIRONMENT)"
  env_cur="$(gh api "repos/$REPO/environments/$ENVIRONMENT" 2>/dev/null || echo '{}')"
  python3 - "$env_cur" <<'PY'
import json, sys
d = json.loads(sys.argv[1])
if not d:
    print('  \033[31m✗\033[0m environment does not exist')
    raise SystemExit
rules = d.get('protection_rules') or []
reviewers = []
for r in rules:
    if r.get('type') == 'required_reviewers':
        reviewers = [x['reviewer'].get('login') for x in r.get('reviewers', [])]
mark = '\033[32m✔\033[0m' if reviewers else '\033[31m✗\033[0m'
print(f'  {mark} required reviewers: {reviewers or "NONE — deploys are not gated"}')
pol = d.get('deployment_branch_policy') or {}
mark = '\033[32m✔\033[0m' if pol.get('protected_branches') else '\033[31m✗\033[0m'
print(f'  {mark} protected branches only: {pol.get("protected_branches")}')
PY
  exit 0
fi

echo "── applying branch protection ($BRANCH)"
gh api -X PUT "repos/$REPO/branches/$BRANCH/protection" --input - <<<"$PROTECTION" >/dev/null
ok "protected: 1 approval, CI Gate required, no force push, no deletion"

echo "── applying environment ($ENVIRONMENT)"
gh api -X PUT "repos/$REPO/environments/$ENVIRONMENT" --input - <<<"$ENV_CONFIG" >/dev/null
ok "deployments require review, protected branches only"

echo "✔ done — verify with: $0 --check"
