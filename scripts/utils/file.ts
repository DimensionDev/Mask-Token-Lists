import path from 'node:path'
import Package from '../../package.json'
import { mkdir } from 'fs/promises'
import fs from 'node:fs/promises'
import { ChainId, FungibleToken } from '../type'
import { EthereumAddress } from 'wallet.ts'

// @ts-ignore
export const pathToVersionFolder = path.join(process.env.PWD, `dist/v${Package.version}`)
// @ts-ignore
export const pathToLatestFolder = path.join(process.env.PWD, `dist/latest`)
// @ts-ignore
export const cryptoRankcacheDir = path.join(process.env.PWD, 'scripts/cache/cryptorank')

export async function writeTokensToFile(chain: ChainId, tokens: FungibleToken[]) {
  await mkdir(path.join(pathToVersionFolder, chain.toString().toLowerCase()), { recursive: true })
  await fs.writeFile(path.join(pathToVersionFolder, chain.toString().toLowerCase(), 'tokens.json'), generate(tokens), {
    encoding: 'utf-8',
  })
  await mkdir(path.join(pathToLatestFolder, chain.toString().toLowerCase()), { recursive: true })
  await fs.writeFile(path.join(pathToLatestFolder, chain.toString().toLowerCase(), 'tokens.json'), generate(tokens), {
    encoding: 'utf-8',
  })
}

function generate(tokens: FungibleToken[]) {
  const tokenList = generateTokenList(
    tokens.map((x) => ({
      ...x,
      // Make sure it's number
      decimals: +x.decimals,
      address: x.chainId !== ChainId.Solana ? EthereumAddress.checksumAddress(x.address) : x.address,
    })),
    {
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
    },
  )

  return JSON.stringify(tokenList)
}

/**
 * generateTokenList.
 *
 * @param {Array<object>} specList
 * @param {Object} extraInfo
 */
function generateTokenList(tokens: FungibleToken[], extraInfo: Record<string, string | string[]>) {
  return {
    name: 'Mask',
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
    ...extraInfo,
    timestamp: new Date().toISOString(),
    version: {
      major: Number.parseInt(Package.version.split('.')[0]),
      minor: Number.parseInt(Package.version.split('.')[1]),
      patch: Number.parseInt(Package.version.split('.')[2]),
    },
    tokens,
  }
}
