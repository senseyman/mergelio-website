#!/usr/bin/env bash
# build.sh — render the site into OUT_DIR with the latest release's version,
# download links, file sizes and SHA-256 digests filled in.
#
#   ./website/build.sh _site                 # asks the GitHub API
#   ./website/build.sh _site release.json    # uses a saved API response
#
# Fails when the release lacks any of the platform files, so a deploy never
# publishes a page with a dead download button.
set -euo pipefail

OUT_DIR=${1:?usage: build.sh OUT_DIR [release.json]}
RELEASE_JSON=${2:-}
REPO=${REPO:-senseyman/mergelio}
SRC_DIR=$(cd "$(dirname "$0")" && pwd)

if [[ -n "$RELEASE_JSON" ]]; then
  release=$(cat "$RELEASE_JSON")
else
  auth=()
  [[ -n "${GH_TOKEN:-}" ]] && auth=(-H "Authorization: Bearer ${GH_TOKEN}")
  release=$(curl -fsSL ${auth[@]+"${auth[@]}"} -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/${REPO}/releases/latest")
fi

tag=$(jq -r '.tag_name' <<<"$release")
version=${tag#v}
date=$(jq -r '.published_at' <<<"$release" | cut -c1-10)
pretty_date=$(date -u -d "$date" '+%B %-d, %Y' 2>/dev/null || date -u -j -f '%Y-%m-%d' "$date" '+%B %-d, %Y')
release_url=$(jq -r '.html_url' <<<"$release")

# Placeholder name → value, applied to index.html below.
subs=(
  "VERSION=${version}"
  "DATE=${pretty_date}"
  "RELEASE_URL=${release_url}"
)

# asset KEY <regex> — fills {{KEY_URL}}, {{KEY_FILE}}, {{KEY_SIZE}} and
# {{KEY_SHA}} from the one release asset whose name matches.
asset() {
  local key=$1 re=$2 row name url size digest
  row=$(jq -c --arg re "$re" '[.assets[] | select(.name | test($re))][0] // empty' <<<"$release")
  if [[ -z "$row" ]]; then
    echo "error: release ${tag} has no asset matching /${re}/" >&2
    exit 1
  fi
  name=$(jq -r '.name' <<<"$row")
  url=$(jq -r '.browser_download_url' <<<"$row")
  size=$(jq -r '.size' <<<"$row")
  digest=$(jq -r '.digest // empty' <<<"$row")
  if [[ "$digest" != sha256:* ]]; then
    echo "error: asset ${name} has no sha256 digest" >&2
    exit 1
  fi
  subs+=(
    "${key}_URL=${url}"
    "${key}_FILE=${name}"
    "${key}_SIZE=$(awk -v b="$size" 'BEGIN { printf "%.1f MB", b / 1048576 }')"
    "${key}_BYTES=${size}"
    "${key}_SHA=${digest#sha256:}"
  )
}

asset MAC  '-macos-arm64\.dmg$'
asset WIN  '-windows-x64-setup\.exe$'
asset DEB  '_amd64\.deb$'
asset RPM  '\.x86_64\.rpm$'
asset SUMS '^SHA256SUMS\.txt$'
asset SIG  '^SHA256SUMS\.txt\.asc$'

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp -R "$SRC_DIR/img" "$SRC_DIR/fonts" "$SRC_DIR/style.css" "$SRC_DIR/main.js" "$SRC_DIR/privacy.html" "$SRC_DIR/CNAME" "$SRC_DIR/robots.txt" "$OUT_DIR/"

# Values are URLs, file names, sizes and hex digests: none contain '|', so it
# is a safe sed delimiter.
sed_args=()
for pair in "${subs[@]}"; do
  sed_args+=(-e "s|{{${pair%%=*}}}|${pair#*=}|g")
done
sed "${sed_args[@]}" "$SRC_DIR/index.html" > "$OUT_DIR/index.html"

# The page only changes meaningfully with a release, so that date is lastmod.
sed -e "s|{{DATE_ISO}}|${date}|g" "$SRC_DIR/sitemap.xml" > "$OUT_DIR/sitemap.xml"

for page in index.html privacy.html sitemap.xml; do
  if grep -q '{{' "$OUT_DIR/$page"; then
    echo "error: unfilled placeholder left in ${page}:" >&2
    grep -o '{{[A-Z_]*}}' "$OUT_DIR/$page" | sort -u >&2
    exit 1
  fi
done

echo "Built ${OUT_DIR} for ${tag}"
