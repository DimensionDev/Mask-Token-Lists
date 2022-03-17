import Package from "../package.json";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { generate as generateFungibleTokens } from "./generate-fungible-tokens";
import { generate as generateNonFungibleTokens } from "./generate-fungible-tokens";
import { getEnumAsArray } from "./helpers";
import { ChainId } from "./types";

async function main() {
  for await (const value of getEnumAsArray(ChainId)) {
    const pathToLatestFolder = resolve(
      __dirname,
      `../dist/latest/${value.value}/`
    );
    const pathToVersionFolder = resolve(
      __dirname,
      `../dist/v${Package.version}/${value.value}/`
    );

    // lastest/tokens.ts
    mkdirSync(pathToLatestFolder, { recursive: true });
    writeFileSync(
      `${pathToLatestFolder}/tokens.json`,
      await generateFungibleTokens(value.value)
    );

    // vx.x.x/tokens.ts
    mkdirSync(pathToVersionFolder, { recursive: true });
    writeFileSync(
      `${pathToVersionFolder}/tokens.json`,
      await generateFungibleTokens(value.value)
    );

    // lastest/non-fungible-tokens.ts
    mkdirSync(pathToLatestFolder, { recursive: true });
    writeFileSync(
      `${pathToLatestFolder}/non-fungible-tokens.json`,
      await generateNonFungibleTokens(value.value)
    );

    // vx.x.x/non-fungible-tokens.ts
    mkdirSync(pathToVersionFolder, { recursive: true });
    writeFileSync(
      `${pathToVersionFolder}/non-fungible-tokens.json`,
      await generateNonFungibleTokens(value.value)
    );

    console.log(
      `Genereated fungible token list for ${value.key} (Chain ID: ${value.value}).`
    );
  }
}

main();
