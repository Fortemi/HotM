#!/usr/bin/env bash
set -euo pipefail

# Fortemi's migration safety gate treats the extension-initialized bootstrap
# database as non-empty before the first application migration. A brand-new
# volume has no recoverable application state, so acknowledge that one bootstrap
# only. Existing volumes retain Fortemi's verified pre-migration backup gate.
if [[ ! -s "${PGDATA:-/var/lib/postgresql/data}/PG_VERSION" \
      && -z "${PRE_MIGRATION_BACKUP_ACK_NO_BACKUP:-}" ]]; then
  export PRE_MIGRATION_BACKUP_ACK_NO_BACKUP=true
  printf '%s\n' 'HotM bundle: acknowledging no pre-migration backup on new empty volume'
fi

node /app/hotm-server.mjs &
hotm_pid=$!

/app/fortemi-entrypoint.sh &
fortemi_pid=$!

terminate() {
  kill -TERM "${hotm_pid}" "${fortemi_pid}" 2>/dev/null || true
  wait "${hotm_pid}" "${fortemi_pid}" 2>/dev/null || true
}
trap terminate EXIT INT TERM

set +e
wait -n "${hotm_pid}" "${fortemi_pid}"
status=$?
set -e

exit "${status}"
