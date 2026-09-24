#!/bin/sh
set -eu
storage_path="${ACTION_PLANS_STORAGE_PATH:-/app/data/action-plans}"
mkdir -p "$storage_path"
chown -R nextjs:nodejs "$storage_path"
exec su nextjs -s /bin/sh -c 'node server.js'
