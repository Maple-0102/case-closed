#!/bin/sh
# Bump the cache-busting version on every page and module import. Usage: scripts/bump-version.sh 20261116j
set -e
cd "$(dirname "$0")/.."
sed -i.bak -E "s/v=[0-9]{8}[a-z]/v=$1/g" index.html src/*.js && rm -f index.html.bak src/*.js.bak
