import { ChainId, FungibleToken, Provider, Providers } from '../type'
import * as fs from 'node:fs/promises'
import { generateLogoURL } from '../utils/asset'
import { differenceBy, some, sortBy, uniqBy } from 'lodash'
import { toChecksumAddress, isAddress } from 'web3-utils'
import { cryptoRankcacheDir, delay } from '../utils'
import getConfig from '../config'
import { explorerDecimalPageMapping, explorerFetchTokenDecimalMapping } from '../utils/base'
import puppeteer from 'puppeteer-extra'
import { executablePath } from 'puppeteer'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())

// data source: https://api.cryptorank.io/v0/tokens/token-platforms
const PlatformMapping = [
  {
    tokenPlatformName: 'Ethereum',
    chainId: ChainId.Mainnet,
  },
  {
    tokenPlatformName: 'BNB',
    chainId: ChainId.BNB,
  },
  {
    tokenPlatformName: 'Polygon',
    chainId: ChainId.Polygon,
  },
  {
    tokenPlatformName: 'Arbitrum',
    chainId: ChainId.Arbitrum,
  },
  {
    tokenPlatformName: 'XDAI',
    chainId: ChainId.xDai,
  },
  {
    tokenPlatformName: 'Fantom',
    chainId: ChainId.Fantom,
  },
  {
    tokenPlatformName: 'Avalanche C-Chain',
    chainId: ChainId.Avalanche,
  },
  {
    tokenPlatformName: 'Aurora',
    chainId: ChainId.Aurora,
  },
  {
    tokenPlatformName: 'Harmony',
    chainId: ChainId.Harmony,
  },
  {
    tokenPlatformName: 'Conflux Network',
    chainId: ChainId.Conflux,
  },
  {
    tokenPlatformName: 'Astar',
    chainId: ChainId.Astar,
  },
  // {
  //   tokenPlatformName: 'Optimism',
  //   chainId: ChainId.Optimistic,
  // },
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

const { TOTAL, CR_WAIT_TIME } = getConfig()

export class SolanaFm implements Provider {
  async generateFungibleTokens(chainId: ChainId, exclude: FungibleToken[]): Promise<FungibleToken[]> {
    const content = await fs.readFile(`${cryptoRankcacheDir}/data.json`, { encoding: 'utf-8' })
    const contentJSON = JSON.parse(content) as TokenInfo[]
    const list = contentJSON
      .filter((x) => {
        const t = x.tokens.find((x) => x.platformName === 'Solana')
        return t && t.address
      })
      .slice(0, 10)
      .map((x) => {
        const token = x.tokens.find((x) => x.platformName === 'Solana')!
        return {
          chainId: ChainId.Solana,
          address: token.address,
          name: x.name,
          symbol: x.symbol,
          logoURI: x.image.x150 ?? x.image.native,
          originLogoURI: x.image.x150 ?? x.image.native,
        }
      })

    const fetchTokenDecimalPage = explorerDecimalPageMapping[chainId]!
    const fetchTokenDecimal = explorerFetchTokenDecimalMapping[chainId]!
    const browser = await puppeteer.launch({ executablePath: executablePath(), timeout: 1000000 })

    const allSettled = await Promise.allSettled(
      list.map(async (x) => {
        const url = fetchTokenDecimalPage(x.address)
        try {
          const decimals = await fetchTokenDecimal(url, browser)
          if (decimals && decimals > 0) return { ...x, decimals } as FungibleToken
          return undefined
        } catch {
          return undefined
        }
      }),
    )
    await browser.close()
    const results = allSettled
      .map((x) => (x.status === 'fulfilled' && x.value ? x.value : undefined))
      .filter((x) => Boolean(x)) as FungibleToken[]

    console.log({ results })
    return results
  }

  getProviderName(): Providers {
    return Providers.solanaFm
  }

  isSupportChain(chainId: ChainId): boolean {
    return chainId === ChainId.Solana
  }
}
