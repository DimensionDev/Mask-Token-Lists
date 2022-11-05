import path from 'node:path'
import fs from 'node:fs/promises'
import { ChainId, FungibleToken } from '../type'
import fastJson from 'fast-json-stringify'
import { convertEnumToArray } from './base'
import { uniq, uniqBy } from 'lodash'

const listBaseInfo = {
  name: 'Mask Network',
  logoURI:
    'https://raw.githubusercontent.com/DimensionDev/Maskbook-Website/master/img/MB--CircleCanvas--WhiteOverBlue.svg',
  keywords: [
    'browser extension',
    'web3',
    'peer to peer',
    'encryption',
    'cryptography',
    'gundb',
    'privacy protection',
    'ownyourdata',
    'social network',
    'blockchain',
    'crypto',
    'dweb',
  ],
  timestamp: new Date().toISOString(),
}

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
        required: ['chainId', 'address', 'name', 'symbol', 'decimals', 'logoURI'],
      },
    ],
  },
})

const stringifyTokenInfo = fastJson({
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
        required: ['chainId', 'address', 'name', 'symbol', 'decimals', 'logoURI'],
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
  await fs.writeFile(path.join(outputDir, `${filename?.toLowerCase()}.json`), stringify(tokens), {
    encoding: 'utf-8',
  })
}

export async function mergeTokenInfoToArtifact(chain: ChainId, tokens: FungibleToken[]) {
  const chains = convertEnumToArray(ChainId)
  const filename = chains.find((x) => x.value === chain)?.key
  const filepath = path.join(cacheDir, `${filename?.toLowerCase()}.json`)
  const existData = await fs.readFile(filepath)
  const existCache = JSON.parse(existData || '[]') as FungibleToken[]
  const data = uniqBy([...tokens, ...existCache], 'address')

  await fs.writeFile(filepath, stringifyTokenInfo(data), {
    encoding: 'utf-8',
  })
}
