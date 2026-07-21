#!/usr/bin/env bash
# Cut a full stable HotM release tag with the OpenBao-custodied release key.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
RELEASE_APPROLE="${HOTM_RELEASE_APPROLE:-ci-hotm}"
VERSION="${1:-}"
shift || true
TAG_MESSAGE=""
DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message) [[ $# -ge 2 ]] || exit 2; TAG_MESSAGE="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "FAIL: unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ "$VERSION" =~ ^[0-9]{4}\.([1-9]|1[0-2])\.([0-9]|[1-9][0-9]+)$ ]] || {
  echo "Usage: $0 YYYY.M.PATCH [-m message] [--dry-run]" >&2
  echo "FAIL: only full stable CalVer releases are accepted." >&2
  exit 2
}
TAG="v$VERSION"

node - "$VERSION" <<'NODE'
const fs = require('node:fs');
const expected = process.argv[2];
const files = ['ui/package.json', 'ui/package-lock.json', 'ui/src-tauri/tauri.conf.json'];
for (const file of files) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8')).version;
  if (value !== expected) throw new Error(`${file} version is '${value}', expected '${expected}'`);
}
const rootLock = JSON.parse(fs.readFileSync('ui/package-lock.json', 'utf8')).packages?.['']?.version;
if (rootLock !== expected) throw new Error(`ui/package-lock.json root version is '${rootLock}', expected '${expected}'`);
NODE
cargo_version="$(sed -n 's/^version = "\([^"]*\)"/\1/p' ui/src-tauri/Cargo.toml | head -1)"
[[ "$cargo_version" == "$VERSION" ]] || {
  echo "FAIL: ui/src-tauri/Cargo.toml version is '$cargo_version', expected '$VERSION'." >&2
  exit 1
}
grep -q "^## \[$VERSION\]" CHANGELOG.md || { echo "FAIL: CHANGELOG.md has no $VERSION entry." >&2; exit 1; }
[[ -f "docs/releases/v$VERSION.md" ]] || { echo "FAIL: docs/releases/v$VERSION.md is missing." >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "FAIL: release tags require a clean worktree." >&2; exit 1; }
git fetch --quiet origin main
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || {
  echo "FAIL: HEAD is not the current origin/main commit." >&2
  exit 1
}
git rev-parse "$TAG" >/dev/null 2>&1 && { echo "FAIL: tag $TAG already exists." >&2; exit 1; }

if [[ "$DRY_RUN" == 1 ]]; then
  probe="$(mktemp /dev/shm/hotm-signing-probe.XXXXXX)"
  trap 'rm -f "$probe" "$probe.sig"' EXIT INT TERM
  printf 'HotM release signing probe\n' >"$probe"
  HOTM_GPG_PURPOSE=release HOTM_OPENBAO_APPROLE="$RELEASE_APPROLE" \
    tools/git/gpg-from-openbao.sh --yes --detach-sign --output "$probe.sig" "$probe"
  echo "OpenBao release signing dry-run passed for $TAG."
  exit 0
fi

[[ -n "$TAG_MESSAGE" ]] || TAG_MESSAGE="$TAG"
HOTM_GPG_PURPOSE=release HOTM_OPENBAO_APPROLE="$RELEASE_APPROLE" \
  git -c gpg.program="$ROOT/tools/git/gpg-from-openbao.sh" \
  tag -s -u 9292EFCBB0EA41BECEEFDAFA9C1B8CE0E0E09C33 "$TAG" -m "$TAG_MESSAGE"
if ! tools/ci/verify-signed-tag.sh "$TAG"; then
  git tag -d "$TAG" >/dev/null 2>&1 || true
  echo "FAIL: local verification failed; $TAG was removed." >&2
  exit 1
fi
echo "Signed and verified $TAG."
echo "Next: git push origin $TAG"
