#!/bin/sh
set -e
echo "[fieldview] running migrations..."
node ./node_modules/prisma/build/index.js migrate deploy
echo "[fieldview] seeding catalog..."
node ./prisma/seed.mjs || true
echo "[fieldview] starting..."
exec node server.js
