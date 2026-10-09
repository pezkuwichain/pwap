#!/usr/bin/env python3
"""Hold web's type errors to a ratchet.

web/ has type errors that predate its typecheck gate; fixing them all at once
would mean editing hundreds of lines of production code with little test
cover, so the gate used to run with continue-on-error and could not fail.
This makes it a real gate without that big bang: the errors that exist are
recorded per file and error code in ops/typecheck-baseline.txt, and the check
fails when any file gains an error of any code. It also fails when errors were
fixed but the baseline was not lowered with them, so a gain cannot quietly be
given back later.

  python3 ops/typecheck-ratchet.py              # check (run from the repo root)
  python3 ops/typecheck-ratchet.py --update     # rewrite the baseline (only ever lower it)

Line numbers are left out of the signature on purpose: they move with every
edit above an error, and a gate that fails on that is a gate people disable.
"""
import collections
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASELINE = ROOT / 'ops' / 'typecheck-baseline.txt'
ERROR = re.compile(r'^(?P<file>[^(\s][^(]*)\(\d+,\d+\): error (?P<code>TS\d+):')


def current() -> collections.Counter:
    out = subprocess.run(['npm', 'run', '--silent', 'typecheck'], cwd=ROOT / 'web',
                         capture_output=True, text=True)
    counts = collections.Counter()
    for line in (out.stdout + out.stderr).splitlines():
        m = ERROR.match(line)
        if m:
            counts[f"{m['file']} {m['code']}"] += 1
    if out.returncode != 0 and not counts:
        sys.exit(f'typecheck failed without reporting type errors:\n{out.stdout}{out.stderr}')
    return counts


def baseline() -> collections.Counter:
    counts = collections.Counter()
    for line in BASELINE.read_text().splitlines():
        if line and not line.startswith('#'):
            n, sig = line.split(' ', 1)
            counts[sig] = int(n)
    return counts


def main() -> int:
    now = current()
    if '--update' in sys.argv:
        lines = [f'{n} {sig}' for sig, n in sorted(now.items())]
        BASELINE.write_text('# count file code — written by ops/typecheck-ratchet.py --update\n'
                            + '\n'.join(lines) + '\n')
        print(f'baseline: {sum(now.values())} errors in {len(now)} file/code pairs')
        return 0

    base = baseline()
    worse = {sig: (base.get(sig, 0), n) for sig, n in now.items() if n > base.get(sig, 0)}
    better = {sig: (n, now.get(sig, 0)) for sig, n in base.items() if now.get(sig, 0) < n}
    for sig, (was, isnow) in sorted(worse.items()):
        print(f'NEW   {sig}: {was} -> {isnow}')
    for sig, (was, isnow) in sorted(better.items()):
        print(f'fixed {sig}: {was} -> {isnow}')
    print(f'type errors: {sum(now.values())} (baseline {sum(base.values())})')
    if worse:
        print('New type errors. Fix them; the baseline only ever goes down.')
        return 1
    if better:
        # Fail here too: a gain that is not written into the baseline can be
        # given back later without the gate noticing.
        print('Fewer errors than the baseline: run with --update and commit the new baseline in this change.')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
