path "kv_internal/data/ci/hotm/*" {
  capabilities = ["read"]
}

path "kv_internal/metadata/ci/hotm/*" {
  capabilities = ["read", "list"]
}

path "kv_internal/data/ci/gitea-clone-token" {
  capabilities = ["read"]
}

path "kv_internal/metadata/ci/gitea-clone-token" {
  capabilities = ["read"]
}

path "kv_internal/data/ci/shared/docs-deploy" {
  capabilities = ["read"]
}

path "kv_internal/metadata/ci/shared/docs-deploy" {
  capabilities = ["read"]
}

path "kv_internal/data/ci/shared/ghcr-token" {
  capabilities = ["read"]
}

path "kv_internal/metadata/ci/shared/ghcr-token" {
  capabilities = ["read"]
}

path "kv_internal/data/ci/shared/mutsu-ssh-key" {
  capabilities = ["read"]
}

path "kv_internal/metadata/ci/shared/mutsu-ssh-key" {
  capabilities = ["read"]
}
