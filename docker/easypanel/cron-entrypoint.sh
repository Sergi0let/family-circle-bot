#!/bin/sh
set -eu

node -e "const { writeFileSync } = require('node:fs'); writeFileSync('/app/.runtime-env.json', JSON.stringify(process.env), { mode: 0o640 });"
chown node:node /app/.runtime-env.json

exec "$@"
