import Package from '../package.json'
import { mkdir, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { generate as generateFungibleTokens } from './generate-fungible-tokens'
import { getEnumAsArray } from './helpers'
import { ChainId } from './types'

async function main() {
  for await (const value of getEnumAsArray(ChainId)) {
    const pathToLatestFolder = resolve(__dirname, `../dist/latest/${value.value}/`)
    const pathToVersionFolder = resolve(__dirname, `../dist/v${Package.version}/${value.value}/`)
    const fungibleTokens = await generateFungibleTokens(value.value)

    // latest/tokens.ts
    await mkdir(pathToLatestFolder, { recursive: true })
    await writeFile(`${pathToLatestFolder}/tokens.json`, fungibleTokens)

    // vx.x.x/tokens.ts
    await mkdir(pathToVersionFolder, { recursive: true })
    await writeFile(`${pathToVersionFolder}/tokens.json`, fungibleTokens)

    console.log(`Genereated fungible token list for ${value.key} (Chain ID: ${value.value}).`)
  }
}

main()
