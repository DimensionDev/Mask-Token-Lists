import { ChainId, FungibleToken, Provider, Providers } from '../type'
import * as fs from 'node:fs/promises'
import { cryptoRankcacheDir } from '../utils'
import { explorerDecimalPageMapping, explorerFetchTokenDecimalMapping } from '../utils/base'
import puppeteer from 'puppeteer-extra'
import { executablePath } from 'puppeteer'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())

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

export class SolanaFm implements Provider {
  async generateFungibleTokens(chainId: ChainId, exclude: FungibleToken[]): Promise<FungibleToken[]> {
    const excludedTokenAddressList = exclude.map((x) => x.address.toLowerCase())
    const content = await fs.readFile(`${cryptoRankcacheDir}/data.json`, { encoding: 'utf-8' })
    const contentJSON = JSON.parse(content) as TokenInfo[]
    const list = contentJSON
      .filter((x) => {
        const t = x.tokens.find((x) => x.platformName === 'Solana')
        return t && t.address
      })
      .slice(0, 100)
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
      .filter((x) => !excludedTokenAddressList.includes(x.address.toLowerCase()))
    console.log({ list })
    const fetchTokenDecimalPage = explorerDecimalPageMapping[chainId]!
    const fetchTokenDecimal = explorerFetchTokenDecimalMapping[chainId]!
    const browser = await puppeteer.launch({ executablePath: executablePath(), timeout: 1000000 })

    const allSettled = await Promise.allSettled(
      list.map(async (x) => {
        const url = fetchTokenDecimalPage(x.address)
        try {
          const decimals = await fetchTokenDecimal(url, browser)
          console.log({ decimals, url })
          if (decimals && decimals > 0) return { ...x, decimals } as FungibleToken
          return undefined
        } catch (e) {
          console.log({ e })
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
