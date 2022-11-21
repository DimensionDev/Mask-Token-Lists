import path from 'node:path'
import fs from 'node:fs/promises'
import { ChainId, FungibleToken } from '../type'
import fastJson from 'fast-json-stringify'
import { convertEnumToArray } from './base'
import { uniq, uniqBy } from 'lodash'

const stringify = fastJson({
  title: 'FungibleTokenList',
  type: 'array',
  items: {
    anyOf: [
      {
        type: 'object',
        properties: {
          chainId: { type: 'number' },
          address: { type: 'string' },
          name: { type: 'string' },
          symbol: { type: 'string' },
          decimals: { type: 'number' },
          logoURI: { type: 'string' },
        },
        required: ['chainId', 'address', 'name', 'symbol', 'decimals'],
      },
    ],
  },
})

const stringifyTokenListCache = fastJson({
  title: 'FungibleTokenListInfo',
  type: 'array',
  items: {
    anyOf: [
      {
        type: 'object',
        properties: {
          chainId: { type: 'number' },
          address: { type: 'string' },
          name: { type: 'string' },
          symbol: { type: 'string' },
          decimals: { type: 'number' },
          logoURI: { type: 'string' },
          originLogoURI: { type: 'string' },
        },
        required: ['chainId', 'address', 'name', 'symbol', 'decimals'],
      },
    ],
  },
})

// @ts-ignore
export const outputDir = path.join(process.env.PWD, 'src/fungible-tokens')
// @ts-ignore
export const cacheDir = path.join(process.env.PWD, 'scripts/cache/origin')

export async function writeTokensToFile(chain: ChainId, tokens: FungibleToken[]) {
  const chains = convertEnumToArray(ChainId)
  const filename = chains.find((x) => x.value === chain)?.key
  await fs.writeFile(path.join(outputDir, `${filename?.toLowerCase()}.json`), JSON.stringify(tokens, undefined, 2), {
    encoding: 'utf-8',
  })
}

export async function mergeTokenListIntoCache(chain: ChainId, tokens: FungibleToken[]) {
  const chains = convertEnumToArray(ChainId)
  const filename = chains.find((x) => x.value === chain)?.key
  const filePath = path.join(cacheDir, `${filename?.toLowerCase()}.json`)
  let existCache: FungibleToken[] = []
  const f = await fs.open(filePath, 'w+')
  await f.close()

  try {
    const existData = await fs.readFile(filePath, { encoding: 'utf-8' })
    existCache = JSON.parse(existData || '[]') as FungibleToken[]
  } catch {}

  const data = uniqBy([...tokens, ...existCache], 'address')

  await fs.writeFile(filePath, stringifyTokenListCache(data), {
    encoding: 'utf-8',
    flag: 'w',
  })
}
