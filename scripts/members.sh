#!/usr/bin/env bash
# Push the family credentials in .members.txt to Vercel, then redeploy.
#
#   ./scripts/members.sh
#
# Format of .members.txt — one person per line, name then password, separated
# by whitespace. Blank lines and lines starting with # are ignored.
#
#   alex     some-long-password
#   jordan   another-one
#
# Passwords cannot contain commas (they are the separator in MEMBERS).
# Never commit .members.txt; it is in .gitignore for a reason.

set -euo pipefail
cd "$(dirname "$0")/.."

FILE=".members.txt"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found. Expected at $(pwd)/$FILE" >&2
  exit 1
fi

PAIRS=""
NAMES=""

while IFS= read -r line; do
  case "$(printf '%s' "$line" | tr -d '[:space:]')" in
    ''|'#'*) continue ;;
  esac

  fields=$(printf '%s' "$line" | wc -w | tr -d ' ')
  [ "$fields" -ne 2 ] && continue

  name=$(printf '%s' "$line" | awk '{print $1}')
  pass=$(printf '%s' "$line" | awk '{print $2}')

  case "$pass" in
    *,*) echo "ERROR: password for '$name' contains a comma — not allowed" >&2; exit 1 ;;
  esac

  PAIRS="${PAIRS:+$PAIRS,}$name:$pass"
  NAMES="$NAMES $name"
done < "$FILE"

if [ -z "$PAIRS" ]; then
  echo "ERROR: no valid 'name password' lines found in $FILE" >&2
  exit 1
fi

echo "Members found:$NAMES"
echo "Pushing MEMBERS to Vercel (production)…"
printf '%s' "$PAIRS" | vercel env add MEMBERS production --force >/dev/null 2>&1 \
  || { echo "ERROR: could not set MEMBERS. Run 'vercel login' and retry." >&2; exit 1; }

echo "Redeploying (env changes need a new deployment)…"
vercel deploy --prod --yes >/tmp/members-deploy.log 2>&1 \
  || { echo "ERROR: deploy failed, see /tmp/members-deploy.log" >&2; exit 1; }

echo
echo "Done. Removed or changed members lose access immediately."
