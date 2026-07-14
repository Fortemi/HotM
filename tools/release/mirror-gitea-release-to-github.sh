#!/usr/bin/env bash
# Mirror one or more Gitea releases, including assets, to GitHub.
#
# Required:
#   gh authenticated locally, or GH_TOKEN/GITHUB_TOKEN in the environment
#
# Optional:
#   GITEA_TOKEN      Token for private Gitea release/assets access
#   GITEA_API_BASE   Default: https://git.integrolabs.net/api/v1
#   GITEA_REPO       Default: Fortemi/HotM
#   GITHUB_REPO      Default: Fortemi/HotM
#
# Usage:
#   tools/release/mirror-gitea-release-to-github.sh v2026.6.0
#   tools/release/mirror-gitea-release-to-github.sh --all

set -euo pipefail

GITEA_API_BASE="${GITEA_API_BASE:-https://git.integrolabs.net/api/v1}"
GITEA_REPO="${GITEA_REPO:-Fortemi/HotM}"
GITHUB_REPO="${GITHUB_REPO:-Fortemi/HotM}"

usage() {
  sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
}

require_tool() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: required tool not found: $1" >&2
    exit 1
  }
}

gitea_curl() {
  if [[ -n "${GITEA_TOKEN:-}" ]]; then
    curl -fsSL -H "Authorization: token ${GITEA_TOKEN}" "$@"
  else
    curl -fsSL "$@"
  fi
}

release_json() {
  local tag="$1"
  gitea_curl "${GITEA_API_BASE}/repos/${GITEA_REPO}/releases/tags/${tag}"
}

github_release_exists() {
  local tag="$1"
  gh release view "$tag" --repo "$GITHUB_REPO" >/dev/null 2>&1
}

ensure_github_release() {
  local json="$1"
  local tag name body prerelease

  tag="$(jq -r '.tag_name' <<<"$json")"
  name="$(jq -r '.name // .tag_name' <<<"$json")"
  body="$(jq -r '.body // ""' <<<"$json")"
  prerelease="$(jq -r '.prerelease // false' <<<"$json")"

  if github_release_exists "$tag"; then
    echo "GitHub release exists: ${tag}"
    return 0
  fi

  echo "Creating GitHub release: ${tag}"
  local args=(release create "$tag" --repo "$GITHUB_REPO" --title "$name" --notes "$body")
  [[ "$prerelease" == "true" ]] && args+=(--prerelease)
  gh "${args[@]}"
}

download_assets() {
  local json="$1"
  local out_dir="$2"

  jq -r '.assets[]? | [.browser_download_url, .name] | @tsv' <<<"$json" |
    while IFS=$'\t' read -r url name; do
      [[ -n "$url" && -n "$name" ]] || continue
      echo "Downloading ${name}"
      if [[ -n "${GITEA_TOKEN:-}" ]]; then
        curl -fsSL -H "Authorization: token ${GITEA_TOKEN}" "$url" -o "${out_dir}/${name}"
      else
        curl -fsSL "$url" -o "${out_dir}/${name}"
      fi
    done
}

upload_assets() {
  local tag="$1"
  local asset_dir="$2"

  shopt -s nullglob
  local assets=("${asset_dir}"/*)
  if (( ${#assets[@]} == 0 )); then
    echo "No assets to mirror for ${tag}"
    return 0
  fi

  echo "Uploading ${#assets[@]} asset(s) to GitHub release ${tag}"
  gh release upload "$tag" --repo "$GITHUB_REPO" "${assets[@]}" --clobber
}

mirror_tag() {
  local tag="$1"
  local tmp json

  echo "==> ${tag}"
  json="$(release_json "$tag")"
  tmp="$(mktemp -d -t hotm-release-mirror.XXXXXX)"

  ensure_github_release "$json"
  download_assets "$json" "$tmp"
  upload_assets "$tag" "$tmp"
  rm -rf "$tmp"
}

list_release_tags() {
  local page=1
  while :; do
    local json count
    json="$(gitea_curl "${GITEA_API_BASE}/repos/${GITEA_REPO}/releases?page=${page}&limit=100")"
    count="$(jq 'length' <<<"$json")"
    (( count == 0 )) && break
    jq -r '.[].tag_name | select(test("^v[0-9]+\\.[0-9]+\\.[0-9]+(-[A-Za-z0-9.]+)?$"))' <<<"$json"
    page=$((page + 1))
  done
}

main() {
  require_tool curl
  require_tool gh
  require_tool jq

  if [[ $# -eq 0 || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  if [[ "${1:-}" == "--all" ]]; then
    mapfile -t tags < <(list_release_tags)
  else
    tags=("$@")
  fi

  if (( ${#tags[@]} == 0 )); then
    echo "No release tags selected." >&2
    exit 1
  fi

  for tag in "${tags[@]}"; do
    mirror_tag "$tag"
  done
}

main "$@"
