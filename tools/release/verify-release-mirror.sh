#!/usr/bin/env bash
# Verify that a GitHub release mirror is provenance-equivalent to Gitea.
#
# This check is intentionally public and secret-free. It compares the exact
# annotated tag object and peeled commit before comparing release metadata,
# asset inventory, and downloaded asset bytes.
#
# Usage:
#   tools/release/verify-release-mirror.sh [--tag-only] v2026.7.0

set -euo pipefail

GITEA_API_BASE="${GITEA_API_BASE:-https://git.integrolabs.net/api/v1}"
GITEA_REPO="${GITEA_REPO:-Fortemi/HotM}"
GITEA_GIT_URL="${GITEA_GIT_URL:-https://git.integrolabs.net/Fortemi/HotM.git}"
GITHUB_API_BASE="${GITHUB_API_BASE:-https://api.github.com}"
GITHUB_REPO="${GITHUB_REPO:-Fortemi/HotM}"
GITHUB_GIT_URL="${GITHUB_GIT_URL:-https://github.com/Fortemi/HotM.git}"

die() {
  printf 'release-mirror: FAIL: %s\n' "$*" >&2
  exit 1
}

require_tool() {
  command -v "$1" >/dev/null 2>&1 || die "required tool not found: $1"
}

tag_refs() {
  local remote="$1"
  local tag="$2"
  git ls-remote "$remote" "refs/tags/${tag}" "refs/tags/${tag}^{}"
}

read_tag_identity() {
  local remote="$1"
  local tag="$2"
  local output direct peeled

  output="$(tag_refs "$remote" "$tag")" ||
    die "could not read ${tag} from ${remote}"
  direct="$(awk -v ref="refs/tags/${tag}" '$2 == ref {print $1}' <<<"$output")"
  peeled="$(awk -v ref="refs/tags/${tag}^{}" '$2 == ref {print $1}' <<<"$output")"

  [[ "$direct" =~ ^[0-9a-f]{40}$ ]] ||
    die "${remote} is missing tag ${tag}"
  [[ "$peeled" =~ ^[0-9a-f]{40}$ ]] ||
    die "${remote} tag ${tag} is not an annotated tag"
  [[ "$direct" != "$peeled" ]] ||
    die "${remote} tag ${tag} does not have a distinct tag object"

  printf '%s %s\n' "$direct" "$peeled"
}

fetch_json() {
  local url="$1"
  curl -fsSL \
    --retry 3 \
    --retry-delay 1 \
    -H 'Accept: application/json' \
    -H 'Cache-Control: no-cache' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    "$url"
}

validate_release_json() {
  local provider="$1"
  local tag="$2"
  local json="$3"

  jq -e --arg tag "$tag" '
    (.tag_name == $tag)
    and (.name | type == "string")
    and (.body | type == "string")
    and (.draft | type == "boolean")
    and (.prerelease | type == "boolean")
    and (.assets | type == "array")
    and (all(.assets[];
      (.name | type == "string")
      and (.name | test("^[A-Za-z0-9][A-Za-z0-9._+-]*$"))
      and (.browser_download_url | type == "string")
    ))
    and (([.assets[].name] | unique | length) == (.assets | length))
  ' <<<"$json" >/dev/null ||
    die "${provider} release metadata or asset names are invalid for ${tag}"
}

download_assets() {
  local json="$1"
  local destination="$2"

  while IFS=$'\t' read -r url name; do
    [[ -n "$url" && -n "$name" ]] || continue
    curl -fsSL \
      --retry 3 \
      --retry-delay 1 \
      -H 'Accept: application/octet-stream' \
      "$url" \
      -o "${destination}/${name}"
  done < <(jq -r '.assets[] | [.browser_download_url, .name] | @tsv' <<<"$json")
}

verify_assets() {
  local tag="$1"
  local gitea_json="$2"
  local github_json="$3"
  local tmp gitea_dir github_dir
  local gitea_names github_names name gitea_sha github_sha

  gitea_names="$(jq -r '.assets[].name' <<<"$gitea_json" | LC_ALL=C sort)"
  github_names="$(jq -r '.assets[].name' <<<"$github_json" | LC_ALL=C sort)"
  [[ "$gitea_names" == "$github_names" ]] ||
    die "asset inventory differs for ${tag}"

  tmp="$(mktemp -d -t hotm-release-mirror-verify.XXXXXX)"
  gitea_dir="${tmp}/gitea"
  github_dir="${tmp}/github"
  mkdir -p "$gitea_dir" "$github_dir"
  trap 'rm -rf -- "$tmp"' RETURN

  download_assets "$gitea_json" "$gitea_dir"
  download_assets "$github_json" "$github_dir"

  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    gitea_sha="$(sha256sum "${gitea_dir}/${name}" | awk '{print $1}')"
    github_sha="$(sha256sum "${github_dir}/${name}" | awk '{print $1}')"
    [[ "$gitea_sha" == "$github_sha" ]] ||
      die "asset bytes differ for ${tag}: ${name}"
  done <<<"$gitea_names"

  rm -rf -- "$tmp"
  trap - RETURN
}

main() {
  local tag_only=0 tag
  local gitea_tag github_tag gitea_object gitea_commit
  local github_object github_commit gitea_json github_json
  local gitea_metadata github_metadata

  if [[ "${1:-}" == "--tag-only" ]]; then
    tag_only=1
    shift
  fi
  [[ $# -eq 1 ]] ||
    die "usage: $0 [--tag-only] v<YYYY.M.PATCH>"
  tag="$1"
  [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][A-Za-z0-9.]+)?$ ]] ||
    die "invalid release tag: ${tag}"

  require_tool curl
  require_tool git
  require_tool jq
  require_tool sha256sum

  gitea_tag="$(read_tag_identity "$GITEA_GIT_URL" "$tag")"
  github_tag="$(read_tag_identity "$GITHUB_GIT_URL" "$tag")"
  read -r gitea_object gitea_commit <<<"$gitea_tag"
  read -r github_object github_commit <<<"$github_tag"

  [[ "$gitea_object" == "$github_object" ]] ||
    die "tag object differs for ${tag}: Gitea=${gitea_object} GitHub=${github_object}"
  [[ "$gitea_commit" == "$github_commit" ]] ||
    die "peeled commit differs for ${tag}: Gitea=${gitea_commit} GitHub=${github_commit}"

  if (( tag_only == 1 )); then
    printf 'release-mirror: OK tag=%s object=%s commit=%s\n' \
      "$tag" "$gitea_object" "$gitea_commit"
    return 0
  fi

  gitea_json="$(fetch_json \
    "${GITEA_API_BASE}/repos/${GITEA_REPO}/releases/tags/${tag}")"
  github_json="$(fetch_json \
    "${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/tags/${tag}")"
  validate_release_json Gitea "$tag" "$gitea_json"
  validate_release_json GitHub "$tag" "$github_json"

  # GitHub removes a single trailing release-note newline while Gitea retains
  # it. Normalize only trailing line endings; all substantive Markdown must
  # remain byte-identical.
  gitea_metadata="$(
    jq -S -c '{tag_name,name,body:(.body | sub("[\r\n]+$"; "")),draft,prerelease}' \
      <<<"$gitea_json"
  )"
  github_metadata="$(
    jq -S -c '{tag_name,name,body:(.body | sub("[\r\n]+$"; "")),draft,prerelease}' \
      <<<"$github_json"
  )"
  [[ "$gitea_metadata" == "$github_metadata" ]] ||
    die "release metadata differs for ${tag}"

  verify_assets "$tag" "$gitea_json" "$github_json"
  printf 'release-mirror: OK tag=%s object=%s commit=%s assets=%s\n' \
    "$tag" \
    "$gitea_object" \
    "$gitea_commit" \
    "$(jq '.assets | length' <<<"$gitea_json")"
}

main "$@"
