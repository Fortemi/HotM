#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FINGERPRINT="SHA256:5g0PgPko1v4soAco1TrwF7uLOMoctLuNKTwGt29PTFk"
CLIENT_FINGERPRINT="SHA256:98FJbexEnVPwJAio08Qv53uEahv4u6V+wSoUQLyKFII"

for workflow in \
  .gitea/workflows/desktop-build-matrix.yml \
  .gitea/workflows/desktop-release.yml \
  .gitea/workflows/mutsu-verify.yml; do
  path="$ROOT/$workflow"
  grep -qF "$FINGERPRINT" "$path"
  grep -qF "$CLIENT_FINGERPRINT" "$path"
  grep -qF "ci/vault-fetch.sh --spec ci/vault-fetch.mutsu.spec" "$path"
  grep -qF 'MUTSU_SSH_KEY_VAULT_PATH: ${{ vars.MUTSU_SSH_KEY_VAULT_PATH }}' "$path"
  grep -qF 'MUTSU_SSH_KEY_VAULT_FIELD: ${{ vars.MUTSU_SSH_KEY_VAULT_FIELD }}' "$path"
  grep -qF "IdentitiesOnly yes" "$path"
  grep -qF "StrictHostKeyChecking yes" "$path"
  grep -qF "PasswordAuthentication no" "$path"
  if grep -qF "StrictHostKeyChecking no" "$path"; then
    echo "$workflow permits an unverified mutsu host key" >&2
    exit 1
  fi
  if grep -qF 'secrets.MUTSU_SSH_KEY' "$path"; then
    echo "$workflow bypasses the approved vault-backed mutsu key" >&2
    exit 1
  fi
done

for workflow in \
  .gitea/workflows/desktop-build-matrix.yml \
  .gitea/workflows/desktop-release.yml; do
  path="$ROOT/$workflow"
  grep -qF "scripts/ci/mutsu-build-lock.sh" "$path"
  grep -qF -- "--timeout 3600" "$path"
  if grep -Eq -- '--label "[^"]* [^"]*"' "$path"; then
    echo "$workflow uses a remote lock label that SSH will split" >&2
    exit 1
  fi
done

echo "mutsu workflow security and serialization checks passed"
