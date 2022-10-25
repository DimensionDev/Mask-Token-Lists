import path from 'node:path'
import fs from 'node:fs/promises'
import { ChainId, FungibleToken } from '../type'
import fastJson from 'fast-json-stringify'
import { convertEnumToArray } from './base'

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

// const stringify = fastJson({
//   title: 'FungibleTokenList',
//   type: 'object',
//   properties: {
//     name: {
//       type: 'string',
//     },
//     logoURI: {
//       type: 'string',
//     },
//     keywords: {
//       type: 'array',
//       items: {
//         anyOf: [{ type: 'string' }],
//       },
//     },
//     timestamp: {
//       type: 'string',
//     },
//     tokens: {
//       type: 'array',
//       items: {
//         anyOf: [
//           {
//             type: 'object',
//             properties: {
//               chainId: { type: 'number' },
//               address: { type: 'string' },
//               name: { type: 'string' },
//               symbol: { type: 'string' },
//               decimals: { type: 'number' },
//               logoURI: { type: 'string' },
//             },
//             required: ['chainId', 'address', 'name', 'symbol', 'decimals', 'logoURI'],
//           },
//         ],
//       },
//     },
//   },
// })
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
export const distDir = path.join(process.env.PWD, 'dist')

export async function writeTokensToFile(chain: ChainId, tokens: FungibleToken[]) {
  const chains = convertEnumToArray(ChainId)
  const filename = chains.find((x) => x.value === chain)?.key
  await fs.writeFile(path.join(outputDir, `${filename?.toLowerCase()}.json`), stringify(tokens), {
    encoding: 'utf-8',
  })
}

export async function writeTokenInfoToArtifact(chain: ChainId, tokens: FungibleToken[]) {
  const chains = convertEnumToArray(ChainId)
  const filename = chains.find((x) => x.value === chain)?.key
  await fs.writeFile(path.join(distDir, `${filename?.toLowerCase()}.json`), stringifyTokenInfo(tokens), {
    encoding: 'utf-8',
  })
}
