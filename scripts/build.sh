#!/usr/bin/env bash

VERSION=$(node -p -e "require('./package.json').version")
CHAIN[0]=dist/v$VERSION
for i in {1,3,4,56,97,100,137,42161,80001}; do
  CHAIN[$i]=dist/v$VERSION/$i
done

mkdir -p dist
mkdir -p latest

# build the latest version
for i in "${!CHAIN[@]}"; do
  printf "Generate for chain id: %s to folder: %s\n" "$i" "${CHAIN[$i]}"
  mkdir -p "${CHAIN[$i]}"
  touch "${CHAIN[$i]}/tokens.json"
  node scripts/generate-erc20.js $i > "${CHAIN[$i]}/tokens.json"
done

node scripts/generate-erc721.js > "dist/mask_nft.json"

# build the current version
#cp dist/v${VERSION}/tokens.json "dist/mask.json"
cp -r dist/v"${VERSION}/" "dist/latest"
cp dist/mask_nft.json "dist/mask_nft_v_$(echo $VERSION | sed "s/\./_/g").json"

echo "v${VERSION} is built."

