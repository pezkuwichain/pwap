#!/usr/bin/env python3
"""Assert that nothing deploys without passing the approval gate.

Approval used to be enforced by GitHub itself: every deploy job carried
`environment: production`, so GitHub held each one until a human approved. That
had to change, because GitHub batches approval requests by eligibility and the
deploy jobs are not eligible at the same moment — a single run asked for
approval twice, minutes apart, and one approval shipped only part of it.

The gate is now a single job, `approve-deploy`, and the deploy jobs are held by
depending on it. That is deterministic, but it moves the guarantee from
"GitHub enforces it" to "the dependency graph says so" — and a graph can be
edited. This script is what makes it a guarantee again: it fails CI if a deploy
job is not behind the gate, or if a second job quietly grows its own
environment and reintroduces the split.

Run: python3 ops/check-deploy-gate.py [workflow.yml ...]
"""

import sys
import yaml

DEFAULT_WORKFLOWS = [".github/workflows/quality-gate.yml"]
GATE = "approve-deploy"
ENVIRONMENT = "production"


def needs_of(job):
    needs = job.get("needs", [])
    return [needs] if isinstance(needs, str) else list(needs)


def environment_of(job):
    env = job.get("environment")
    if isinstance(env, dict):
        return env.get("name")
    return env


def check(path):
    with open(path) as fh:
        workflow = yaml.safe_load(fh)

    jobs = workflow.get("jobs", {})
    problems = []

    gated = [
        name
        for name, job in jobs.items()
        if environment_of(job) == ENVIRONMENT
    ]

    if gated != [GATE]:
        problems.append(
            f"exactly one job may declare `environment: {ENVIRONMENT}`, and it must be "
            f"`{GATE}`; found {gated or 'none'}. More than one splits the run into "
            f"separate approval rounds — the failure this design exists to prevent."
        )

    if GATE not in jobs:
        problems.append(f"`{GATE}` is missing; nothing holds the deploys.")
        return problems

    for name, job in jobs.items():
        if not name.startswith("deploy-") or name == GATE:
            continue
        if GATE not in needs_of(job):
            problems.append(
                f"`{name}` does not list `{GATE}` in its needs, so it would deploy "
                f"without approval."
            )
            continue
        condition = str(job.get("if", ""))
        # `always()` overrides the implicit "all needs succeeded" rule, so the
        # dependency alone stops holding and the condition has to say so.
        if "always()" in condition and f"needs.{GATE}.result == 'success'" not in condition:
            problems.append(
                f"`{name}` uses always() but does not require "
                f"needs.{GATE}.result == 'success' — with always(), depending on the "
                f"gate no longer waits for it to pass."
            )

    return problems


def main(argv):
    paths = argv[1:] or DEFAULT_WORKFLOWS
    failed = False

    for path in paths:
        problems = check(path)
        if problems:
            failed = True
            print(f"{path}:")
            for problem in problems:
                print(f"  - {problem}")
        else:
            print(f"{path}: every deploy job is behind `{GATE}`.")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
