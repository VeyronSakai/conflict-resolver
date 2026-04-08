#!/usr/bin/env bash
set -eu

if [ "${CONFLICT_RESOLVER_FILE_PATH:-}" = "package-lock.json" ] && \
  [ "${CONFLICT_RESOLVER_CONFLICT_TYPE:-}" = "both-modified" ]; then
  echo "theirs"
else
  echo "manual"
fi
