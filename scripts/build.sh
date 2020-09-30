#!/usr/bin/env bash

VERSION=$(node -p -e "require('./package.json').version")

mkdir -p dist

# build the latest version
node src/index.js > "dist/maskbook.json"

# build the current version
cp dist/maskbook.json "dist/maskbook_v_$(echo $VERSION | sed "s/\./_/g").json"

echo "v${VERSION} is built."

