import { ChainId, FungibleToken, Provider, Providers } from '../type'
import {
  explorerFetchMapping,
  explorerPagesMapping,
  explorerDecimalPageMapping,
  explorerFetchTokenDecimalMapping,
} from '../utils/base'

import puppeteer from 'puppeteer-extra'
import { executablePath } from 'puppeteer'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())

export class Explorer implements Provider {
  getProviderName(): Providers {
    return Providers.explorer
  }

  isSupportChain(chainId: ChainId): boolean {
    return !!explorerPagesMapping[chainId]?.length
  }

  async generateFungibleTokens(chainId: ChainId, exclude: FungibleToken[]): Promise<FungibleToken[]> {
    const fetch = explorerFetchMapping[chainId]
    const fetchPages = explorerPagesMapping[chainId]
    const fetchTokenDecimalPage = explorerDecimalPageMapping[chainId]
    const fetchTokenDecimal = explorerFetchTokenDecimalMapping[chainId]
    const excludedTokenAddressList = exclude.map((x) => x.address.toLowerCase())

    let totalResults: FungibleToken[] = []

    if (!fetch || !fetchPages || !fetchTokenDecimalPage || !fetchTokenDecimal) return totalResults

    for (let i = 0; i < fetchPages.length; i++) {
      const url = fetchPages[i]
      try {
        const results_ = await fetch(url)

        const newAddedResults = results_.filter((x) => !excludedTokenAddressList.includes(x.address.toLowerCase()))
        // Reuse the same browser in the loop. It will be faster and will use less resources.
        // To prevent MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
        const browser = await puppeteer.launch({ executablePath: executablePath(), timeout: 1000000 })
        const allSettled = await Promise.allSettled(
          newAddedResults.map(async (x) => {
            const url = fetchTokenDecimalPage(x.address)
            try {
              const decimals = await fetchTokenDecimal(url, browser)
              return { ...x, decimals } as FungibleToken
            } catch {
              return undefined
            }
          }),
        )
        await browser.close()
        const results = allSettled
          .map((x) => (x.status === 'fulfilled' && x.value ? x.value : undefined))
          .filter((x) => Boolean(x)) as FungibleToken[]
        console.log({ results, newAddedResultsLength: newAddedResults.length, originResultsLength: results_.length })
        totalResults = totalResults.concat(results)
      } catch (error) {
        console.log({ url })
        console.log(`Failed to fetch ${url}`, error)
        continue
      }
    }
    return totalResults
  }
}
