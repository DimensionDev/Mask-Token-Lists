import urlcat from 'urlcat'
import { ChainId, FungibleToken, Provider, Providers } from '../type'
import * as cheerio from 'cheerio'
import axios from 'axios'
import { toChecksumAddress } from 'web3-utils'
import { generateLogoURL } from '../utils/asset'

const basURLMapping: Partial<Record<ChainId, string>> = {
  [ChainId.Mainnet]: 'https://etherscan.io',
  [ChainId.BNB]: 'https://bscscan.com',
  [ChainId.Polygon]: 'https://polygonscan.com',
  [ChainId.Arbitrum]: 'https://arbiscan.io',
  [ChainId.Avalanche]: 'https://snowtrace.io',
  [ChainId.Fantom]: 'https://ftmscan.com',
  // [ChainId.Gnosis]: 'https://gnosisscan.io',
  [ChainId.Aurora]: 'https://aurorascan.dev',
  [ChainId.Optimistic]: 'https://optimistic.etherscan.io',
}

const requestAcceptHeader =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'

export class Explorer implements Provider {
  getProviderName(): Providers {
    return Providers.explorer
  }

  isSupportChain(chainId: ChainId): boolean {
    return !!basURLMapping[chainId]
  }

  async generateFungibleTokens(chainId: ChainId, exclude: FungibleToken[]): Promise<FungibleToken[]> {
    const baseURL = basURLMapping[chainId]!
    let page = 1
    let result: FungibleToken[] = []
    while (page <= 2) {
      const url = urlcat(baseURL, 'tokens', { p: page, ps: 10 })
      const html = await axios.get(url, {
        headers: {
          accept: requestAcceptHeader,
        },
      })
      const q = cheerio.load(html.data)
      const table = q('#tblResult tbody tr').map((_, x) => x)

      // @ts-ignore
      for (const x of table) {
        const logo = q('img', x).attr('src')

        const fullname = q('.media-body a', x).text()
        if (!fullname) continue

        const pageLink = q('.media-body a', x).attr('href')
        if (!pageLink) continue

        const address = toChecksumAddress(pageLink?.replace('/token/', ''))
        if (!address) continue

        const decimals = await this.getTokenDecimals(urlcat(baseURL, pageLink))

        const token = {
          chainId: chainId,
          address: address,
          name: fullname.replace(/ \(.*\)/g, ''),
          symbol:
            fullname
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
    const html = await axios.get(link, {
      headers: {
        accept: requestAcceptHeader,
      },
    })
    const q = cheerio.load(html.data)
    const decimals = q('#ContentPlaceHolder1_trDecimals .row div:nth-child(2)').text()
    return parseInt(decimals)
  }
}
