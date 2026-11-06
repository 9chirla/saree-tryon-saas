#!/usr/bin/env bash
# Trail9 nightly Postgres backup → private customer S3 bucket.
# Credentials come only from environment / EnvironmentFile — never hard-coded.
# Exit non-zero on any failure.
set -euo pipefail

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

require() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    die "missing required env var: $name"
  fi
}

require DATABASE_URL
require S3_ENDPOINT
require S3_REGION
require S3_ACCESS_KEY_ID
require S3_SECRET_ACCESS_KEY
require S3_BUCKET_CUSTOMER

command -v pg_dump >/dev/null || die "pg_dump not found on PATH"
command -v gzip >/dev/null || die "gzip not found on PATH"
command -v aws >/dev/null || die "aws CLI not found on PATH (needed for S3 upload)"

DATE_UTC="$(date -u +%F)"
WORKDIR="${TRAIL9_BACKUP_WORKDIR:-/var/tmp/trail9-backups}"
mkdir -p "$WORKDIR"
DUMP_PATH="${WORKDIR}/trail9-${DATE_UTC}.sql.gz"
OBJECT_KEY="backups/${DATE_UTC}.sql.gz"
S3_URI="s3://${S3_BUCKET_CUSTOMER}/${OBJECT_KEY}"

export AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="${S3_REGION}"

AWS_ARGS=(--endpoint-url "${S3_ENDPOINT}")
if [[ "${S3_FORCE_PATH_STYLE:-true}" == "true" ]]; then
  AWS_CFG_DIR="${WORKDIR}/aws-config"
  mkdir -p "${AWS_CFG_DIR}"
  cat >"${AWS_CFG_DIR}/config" <<'EOF'
[default]
s3 =
    addressing_style = path
EOF
  export AWS_CONFIG_FILE="${AWS_CFG_DIR}/config"
fi

log "starting pg_dump → ${DUMP_PATH}"
# Do not echo DATABASE_URL or AWS secrets.
pg_dump --no-owner --no-acl --dbname="${DATABASE_URL}" | gzip -c >"${DUMP_PATH}"
[[ -s "${DUMP_PATH}" ]] || die "dump file is empty: ${DUMP_PATH}"

log "uploading ${OBJECT_KEY} to customer bucket"
aws "${AWS_ARGS[@]}" s3 cp "${DUMP_PATH}" "${S3_URI}" \
  --only-show-errors \
  --content-type "application/gzip"

log "pruning dumps older than 14 days under s3://${S3_BUCKET_CUSTOMER}/backups/"
CUTOFF_EPOCH="$(date -u -d '14 days ago' +%s)"
mapfile -t KEYS < <(aws "${AWS_ARGS[@]}" s3api list-objects-v2 \
  --bucket "${S3_BUCKET_CUSTOMER}" \
  --prefix "backups/" \
  --query 'Contents[].Key' \
  --output text 2>/dev/null | tr '\t' '\n' || true)

for key in "${KEYS[@]:-}"; do
  [[ -z "${key}" || "${key}" == "None" ]] && continue
  base="$(basename "${key}")"
  [[ "${base}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}\.sql\.gz$ ]] || continue
  day="${base%.sql.gz}"
  day_epoch="$(date -u -d "${day}" +%s)"
  if (( day_epoch < CUTOFF_EPOCH )); then
    log "deleting expired backup s3://${S3_BUCKET_CUSTOMER}/${key}"
    aws "${AWS_ARGS[@]}" s3 rm "s3://${S3_BUCKET_CUSTOMER}/${key}" --only-show-errors
  fi
done

rm -f "${DUMP_PATH}"
log "backup OK: ${S3_URI}"
