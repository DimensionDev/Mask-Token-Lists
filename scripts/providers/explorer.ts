import { ChainId, FungibleToken, Provider, Providers } from '../type'
import { explorerBasURLMapping, explorerFetchMapping, explorerPagesMapping } from '../utils/base'

export class Explorer implements Provider {
  getProviderName(): Providers {
    return Providers.explorer
  }

  isSupportChain(chainId: ChainId): boolean {
    return !!explorerBasURLMapping[chainId]
  }

  async generateFungibleTokens(chainId: ChainId, exclude: FungibleToken[]): Promise<FungibleToken[]> {
    const fetch = explorerFetchMapping[chainId]
    const fetchPages = explorerPagesMapping[chainId]

    let results: FungibleToken[] = []

    if (!fetch || !fetchPages) return results

    for (let i = 0; i < fetchPages.length; i++) {
      const url = fetchPages[i]
      try {
        results = results.concat(await fetch(url))
      } catch {
        console.log(`Failed to fetch ${url}.`)
        continue
      }
    }
    console.log({ results })
    return results
  }
}
