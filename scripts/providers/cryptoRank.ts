import { ChainId, FungibleToken, Provider, Providers } from '../type'
import * as fs from 'node:fs/promises'
import { generateLogoURL } from '../utils/asset'
import { differenceBy, some, uniqBy } from 'lodash'
import { getTokenDecimals } from '../utils/base'
import { toChecksumAddress } from 'web3-utils'
import { delay } from '../utils'

// data source: https://api.cryptorank.io/v0/tokens/token-platforms
const PlatformMapping = [
  {
    tokenPlatformName: 'Ethereum',
    chainId: ChainId.Mainnet,
  },
]

export interface TokenInfo {
  rank: number
  key: string
  name: string
  symbol: string
  type: string
  image: Image
  tokens: Token[]
}

export interface Image {
  native: string
  icon: string
  x60: string
  x150: string
}

export interface Token {
  platformName: string
  platformKey: string
  platformSlug: string
  explorerUrl: string
  address: string
}

export class CryptoRank implements Provider {
  async generateFungibleTokens(chainId: ChainId, exclude: FungibleToken[]): Promise<FungibleToken[]> {
    const platform = PlatformMapping.find((x) => x.chainId === chainId)!
    const content = await fs.readFile('scripts/cache/cryptorank/data.json', { encoding: 'utf-8' })
    const contentJSON = JSON.parse(content) as TokenInfo[]
    const list = contentJSON
      .filter((x) => {
        const t = x.tokens.find((x) => x.platformName === platform.tokenPlatformName)
        return t && t.address
      })
      .map((t) => {
        const token = t.tokens.find((x) => x.platformName === platform.tokenPlatformName)!
        return {
          chainId,
          address: toChecksumAddress(token.address),
          name: t.name,
          symbol: t.symbol,
          logoURI: generateLogoURL(chainId, toChecksumAddress(token.address)),
          originLogoURI: t.image.x150 ?? t.image.native,
        }
      })

    const topList = uniqBy(list, 'address').slice(0, 1000)
    const toAddList = differenceBy(topList, exclude, (x) =>
      some(exclude, (e) => x.address.toLowerCase() === e.address.toLowerCase()),
    )

    console.log(`The total tokens length: is: ${topList.length}`)
    console.log(`The difference tokens length: is: ${toAddList.length}`)

    const result: FungibleToken[] = []
    for (const token of toAddList) {
      if (token.symbol === 'eth') continue

      const decimals = await getTokenDecimals(chainId, token.address)
      if (!decimals) continue

      result.push({
        decimals: decimals,
        ...token,
      })
      await delay(500)
    }
    return [...result, ...exclude].filter(
      (x) => x.address && list.find((e) => e.symbol.toLowerCase() === x.symbol.toLowerCase()),
    )
  }

  getProviderName(): Providers {
    return Providers.cryptoRank
  }

  isSupportChain(chainId: ChainId): boolean {
    return !!PlatformMapping.find((x) => x.chainId === chainId)
  }
}
