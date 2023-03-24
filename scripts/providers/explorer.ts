import { ChainId, FungibleToken, Provider, Providers } from '../type'
import { explorerBasURLMapping, explorerFetchMapping, explorerPagesMapping } from '../utils/base'
import getConfig from '../config'

const { EXPLORER_PAGE_SIZE, TOTAL } = getConfig()

export class Explorer implements Provider {
  getProviderName(): Providers {
    return Providers.explorer
  }

  isSupportChain(chainId: ChainId): boolean {
    return !!explorerBasURLMapping[chainId]
  }

  async generateFungibleTokens(chainId: ChainId, exclude: FungibleToken[]): Promise<FungibleToken[]> {
    const baseURL = explorerBasURLMapping[chainId]!
    const fetch = explorerFetchMapping[chainId]
    const fetchPages = explorerPagesMapping[chainId]

    let result: FungibleToken[] = []

    if (!fetch || !fetchPages) return result

    for (let i = 0; i < fetchPages.length; i++) {
      const url = fetchPages[i]
      result = result.concat(await fetch(url))
    }
    console.log({ result })
    return result
  }
}
