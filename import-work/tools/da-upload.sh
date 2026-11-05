#!/bin/zsh
# Uploads media + documents + sheets (built by build-da.mjs) to da.live, then previews / publishes.
# usage: da-upload.sh [upload|preview|publish|all]   (all = upload + preview + publish)
# html documents are addressed without extension, json sheets keep their .json extension.
set -u
ORG=azouaoui-deloitte
REPO=eds-intact-da
DIR=${0:A:h}/../da
DA_TOKEN=$(node -e "process.stdout.write(require(process.env.HOME + '/.aem/da-token.json').access_token)")
MODE=${1:-all}
T() { perl -e 'alarm shift; exec @ARGV' 60 "$@"; }

ctype() {
  case ${1:e} in
    png) echo image/png ;; jpg|jpeg) echo image/jpeg ;; svg) echo image/svg+xml ;;
    html) echo text/html ;; json) echo application/json ;; *) echo application/octet-stream ;;
  esac
}
FILES=(${(f)"$(cd $DIR && find . -type f ! -name '.*' | sed 's#^\./##' | sort)"})
DOCS=(${(M)FILES:#*.(html|json)})

if [[ $MODE == upload || $MODE == all ]]; then
  for rel in $FILES; do
    T curl -s -o /dev/null -w "%{http_code} source /$rel\n" -X POST "https://admin.da.live/source/$ORG/$REPO/$rel" \
      -H "Authorization: Bearer $DA_TOKEN" -F "data=@$DIR/$rel;type=$(ctype $rel)"
  done
fi

step() { # verb rel
  local p
  if [[ $2 == *.json ]]; then p=$2; else p=${2%.html}; fi
  T curl -s -o /dev/null -w "%{http_code} $1 /$p\n" -X POST "https://admin.hlx.page/$1/$ORG/$REPO/main/$p" -H "Authorization: Bearer $DA_TOKEN"
}
if [[ $MODE == preview || $MODE == all || $MODE == publish ]]; then for rel in $DOCS; do step preview $rel; done; fi
if [[ $MODE == publish || $MODE == all ]]; then for rel in $DOCS; do step live $rel; done; fi
