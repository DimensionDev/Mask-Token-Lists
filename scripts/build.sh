#!/usr/bin/env bash

VERSION=$(node -p -e "require('./package.json').version")

mkdir -p dist
node src/index.js > "dist/maskbook.json"

echo "v${VERSION} is built."