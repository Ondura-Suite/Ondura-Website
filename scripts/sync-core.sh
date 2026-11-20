#!/usr/bin/env bash
# Pulls everything the website shows about the app from Ondura-Core into
# the site folder: screenshots, app icons and the latest release metadata.
#
# Usage: scripts/sync-core.sh <path-to-Ondura-Core-checkout> [site-dir]
#
# GITHUB_TOKEN is optional; without it the GitHub API rate limit for
# anonymous requests applies (fine for local use).

set -euo pipefail

CORE_DIR="${1:?path to an Ondura-Core checkout required}"
SITE_DIR="${2:-$(dirname "$0")/../site}"
REPO="${ONDURA_CORE_REPO:-Ondura-Suite/Ondura-Core}"

screens="$SITE_DIR/assets/screens"
brand="$SITE_DIR/assets/brand"
mkdir -p "$screens" "$brand"

# Screenshots: docs/screenshots is the single source of truth.
rm -f "$screens"/*.png
cp "$CORE_DIR"/docs/screenshots/*.png "$screens"/

# App icons as shipped with the app.
for icon in ondura mail text sheets slides pdf notes planner diagram forms; do
  cp "$CORE_DIR/apps/ondura/public/$icon.svg" "$brand/$icon.svg"
done

# Latest published release (pre-releases included, drafts excluded),
# reduced to the fields the page needs. Written as release.json so
# visitors never talk to the GitHub API themselves.
auth=()
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  auth=(-H "Authorization: Bearer $GITHUB_TOKEN")
fi

# write_release <owner/repo> <output file>
write_release() {
  local releases
  releases="$(curl -fsSL "${auth[@]}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$1/releases?per_page=20" || echo '[]')"
  echo "$releases" | jq '
    [ .[] | select(.draft | not) ] | first //
    null |
    if . == null then { tag: null } else {
      tag: .tag_name,
      name: .name,
      prerelease: .prerelease,
      published_at: .published_at,
      html_url: .html_url,
      assets: [ .assets[] | { name, size, url: .browser_download_url } ]
    } end
  ' > "$2"
}

write_release "$REPO" "$SITE_DIR/release.json"
# Ondura Mail for Android lives in its own repository.
write_release "${ONDURA_ANDROID_REPO:-Ondura-Suite/Ondura-Android}" "$SITE_DIR/release-android.json"

echo "Synced $(ls "$screens" | wc -l) screenshots, icons, release $(jq -r '.tag // "none"' "$SITE_DIR/release.json") and Android release $(jq -r '.tag // "none"' "$SITE_DIR/release-android.json")."
