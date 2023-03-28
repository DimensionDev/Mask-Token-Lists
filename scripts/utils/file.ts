import path from 'node:path'
import Package from '../../package.json'
import { mkdir } from 'fs/promises'
import fs from 'node:fs/promises'
import { ChainId, FungibleToken } from '../type'
import { generateTokenList } from '../../src/helpers/generate-token-list'
import { EthereumAddress } from 'wallet.ts'

// @ts-ignore
export const pathToVersionFolder = path.join(process.env.PWD, `dist/v${Package.version}`)
// @ts-ignore
export const pathToLatestFolder = path.join(process.env.PWD, `dist/latest`)
// @ts-ignore
export const cryptoRankcacheDir = path.join(process.env.PWD, 'scripts/cache/cryptorank')

export async function writeTokensToFile(chain: ChainId, tokens: FungibleToken[]) {
  await mkdir(path.join(pathToVersionFolder, chain.toString()), { recursive: true })
  await fs.writeFile(path.join(pathToVersionFolder, chain.toString(), 'tokens.json'), generate(tokens), {
    encoding: 'utf-8',
  })
  await mkdir(path.join(pathToLatestFolder, chain.toString()), { recursive: true })
  await fs.writeFile(path.join(pathToLatestFolder, chain.toString(), 'tokens.json'), generate(tokens), {
    encoding: 'utf-8',
  })
}

function generate(tokens: FungibleToken[]) {
  const tokenList = generateTokenList(
    tokens
      .map((x) => ({
        ...x,
        address: EthereumAddress.checksumAddress(x.address),
      }))
      .sort((a, z) => {
        if (a.name > z.name) return 1
        if (a.name < z.name) return -1
        return 0
      }),
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

  return JSON.stringify(tokenList, undefined, 2)
}
