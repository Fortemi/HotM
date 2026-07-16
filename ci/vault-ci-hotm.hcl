path "${HOTM_VAULT_DATA_PREFIX}/*" {
  capabilities = ["read"]
}

path "${HOTM_VAULT_METADATA_PREFIX}/*" {
  capabilities = ["read", "list"]
}

path "${CLONE_TOKEN_VAULT_DATA_PATH}" {
  capabilities = ["read"]
}

path "${CLONE_TOKEN_VAULT_METADATA_PATH}" {
  capabilities = ["read"]
}

path "${DOCS_DEPLOY_KEY_VAULT_DATA_PATH}" {
  capabilities = ["read"]
}

path "${DOCS_DEPLOY_KEY_VAULT_METADATA_PATH}" {
  capabilities = ["read"]
}

path "${GH_PUBLISH_TOKEN_VAULT_DATA_PATH}" {
  capabilities = ["read"]
}

path "${GH_PUBLISH_TOKEN_VAULT_METADATA_PATH}" {
  capabilities = ["read"]
}

path "${MUTSU_SSH_KEY_VAULT_DATA_PATH}" {
  capabilities = ["read"]
}

path "${MUTSU_SSH_KEY_VAULT_METADATA_PATH}" {
  capabilities = ["read"]
}
