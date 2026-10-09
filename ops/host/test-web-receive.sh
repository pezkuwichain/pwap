#!/bin/bash
# Exercises pwap-web-receive against a scratch web root: what it installs,
# with which modes, and everything it must refuse. The script under test is
# copied with its web roots pointed at the scratch directory; nothing else
# about it changes.
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/app" "$T/pex" "$T/tmp/stage"
export TMPDIR="$T/tmp/stage"   # stage = $T/tmp/stage/tmp.X, so ../../.. is $T
sed -e "s#/var/www/subdomains/app#$T/app#" -e "s#/var/www/pex.mom#$T/pex#" \
  "$HERE/pwap-web-receive" > "$T/receive"
chmod +x "$T/receive"

pass=0; fail=0
check () { if eval "$2"; then echo "ok    $1"; pass=$((pass+1)); else echo "FAIL  $1"; fail=$((fail+1)); fi; }

site () {  # site <dir> <sha> [index]
  mkdir -p "$1/assets"
  echo "${3:-<html>new</html>}" > "$1/index.html"
  echo "console.log(1)" > "$1/assets/index-NEW.js"
  echo "$2" > "$1/.deploy-sha"
}
run () {  # run <site-arg> <ssh-command> <tar-dir>
  ( cd "$3" && tar -cf - . ) | SSH_ORIGINAL_COMMAND="$2" "$T/receive" "$1" >/dev/null 2>&1
}

# an earlier build is live, with a chunk the new one no longer has
mkdir -p "$T/app/assets"; echo old > "$T/app/assets/index-OLD.js"; echo "<html>old</html>" > "$T/app/index.html"

site "$T/s1" b09af9bfbd02e477749d81611bb91ecabf6b0105
run app deploy "$T/s1"; rc=$?
check "a valid build installs"                       '[ $rc = 0 ] && grep -q new "$T/app/index.html"'
check "it is the build that was sent"                 'cmp -s "$T/s1/assets/index-NEW.js" "$T/app/assets/index-NEW.js"'
check "the SHA is recorded"                           'grep -qx b09af9bfbd02e477749d81611bb91ecabf6b0105 "$T/app/.deploy-sha"'
check "chunks of the previous build stay"             '[ -f "$T/app/assets/index-OLD.js" ]'
check "files are world-readable (664)"                '[ "$(stat -c %a "$T/app/index.html")" = 664 ] && [ "$(stat -c %a "$T/app/assets/index-NEW.js")" = 664 ]'
check "directories are traversable (2775)"            '[ "$(stat -c %a "$T/app/assets")" = 2775 ]'
check "the other site is untouched"                   '[ -z "$(ls -A "$T/pex")" ]'

before=$(cat "$T/app/index.html")
mkdir -p "$T/s2/assets"; echo x > "$T/s2/assets/a.js"; echo abc1234 > "$T/s2/.deploy-sha"
run app deploy "$T/s2"; rc=$?
check "a tar without index.html is refused"           '[ $rc != 0 ] && [ "$(cat "$T/app/index.html")" = "$before" ]'

site "$T/s3" 'not-a-sha; rm -rf /'
run app deploy "$T/s3"; rc=$?
check "a .deploy-sha that is not a SHA is refused"    '[ $rc != 0 ] && [ "$(cat "$T/app/index.html")" = "$before" ]'

site "$T/s4" abc1234
run app 'deploy; id' "$T/s4"; rc1=$?
run app '' "$T/s4"; rc2=$?
check "any command but deploy is refused"             '[ $rc1 = 2 ] && [ $rc2 = 2 ] && [ "$(cat "$T/app/index.html")" = "$before" ]'

run other deploy "$T/s4"; rc=$?
check "an unknown site is refused"                     '[ $rc = 2 ]'

site "$T/s5" abc1234
ln -s /etc/passwd "$T/s5/assets/passwd.js"
run app deploy "$T/s5"; rc=$?
check "a symlink in the upload is not installed"      '[ $rc = 0 ] && [ ! -e "$T/app/assets/passwd.js" ] && [ ! -L "$T/app/assets/passwd.js" ]'

site "$T/s6" abc1234
( cd "$T/s6" && tar -cf "$T/evil.tar" . && tar -rf "$T/evil.tar" --transform 's#^#../../../#' index.html ) 2>/dev/null
SSH_ORIGINAL_COMMAND=deploy "$T/receive" app < "$T/evil.tar" >/dev/null 2>&1
check "a ../ member cannot write outside the stage"   '[ ! -e "$T/index.html" ] && [ ! -e "$T/tmp/index.html" ]'

echo "RESULT: $pass passed, $fail failed"
[ "$fail" = 0 ]
