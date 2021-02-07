#!/usr/bin/env bash

VERSION=$(node -p -e "require('./package.json').version")

mkdir -p dist

# build the latest version
node src/index.js > "dist/mask.json"

# build the current version
cp dist/mask.json "dist/mask_v_$(echo $VERSION | sed "s/\./_/g").json"

echo "v${VERSION} is built."

