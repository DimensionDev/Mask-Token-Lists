#!/usr/bin/env bash

VERSION=$(node -p -e "require('./package.json').version")

mkdir -p dist

# build the latest version
node scripts/generate-erc20.js > "dist/mask.json"
node scripts/generate-erc721.js > "dist/mask_nft.json"

# build the current version
cp dist/mask.json "dist/mask_v_$(echo $VERSION | sed "s/\./_/g").json"
cp dist/mask_nft.json "dist/mask_nft_v_$(echo $VERSION | sed "s/\./_/g").json"

echo "v${VERSION} is built."

