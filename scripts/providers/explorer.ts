import urlcat from 'urlcat'
import { ChainId, FungibleToken, Provider, Providers } from '../type'
import * as cheerio from 'cheerio'
import { toChecksumAddress } from 'web3-utils'
import { generateLogoURL } from '../utils/asset'
import { explorerBasURLMapping, fetchExplorerPage } from '../utils/base'
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
    let page = 1
    let result: FungibleToken[] = []
    while (page <= TOTAL / EXPLORER_PAGE_SIZE) {
      const url = urlcat(baseURL, 'tokens', { p: page, ps: EXPLORER_PAGE_SIZE })
      const pageData = await fetchExplorerPage(url)
      const q = cheerio.load(pageData)
      const table = q('table tbody tr').map((_, x) => x)
      // @ts-ignore
      for (const x of table) {
        const logo = q('img', x).attr('src')

        const fullName = q('a.text-truncate', x).text()
        console.log({ x, fullName, logo })
        if (!fullName) continue

        const pageLink = q('a.text-truncate', x).attr('href')
        if (!pageLink) continue

        const address = toChecksumAddress(pageLink?.replace('/token/', ''))
        if (!address) continue

        const decimals = await this.getTokenDecimals(urlcat(baseURL, pageLink))

        const token = {
          chainId: chainId,
          address: address,
          name: fullName.replace(/ \(.*\)/g, ''),
          symbol:
            fullName
              .match(/\(.*\)$/g)?.[0]
              ?.replace('(', '')
              .replace(')', '') ?? '',
          decimals: decimals,
          logoURI: generateLogoURL(chainId, address),
          originLogoURI: urlcat(baseURL, logo ?? ''),
        }

        result.push(token)
      }

      page++
    }
    return result
  }

  async getTokenDecimals(link: string) {
    const data = await fetchExplorerPage(link)
    const q = cheerio.load(data)
    const decimals = q('#ContentPlaceHolder1_trDecimals .row div:nth-child(2)').text()
    return parseInt(decimals)
  }
}
