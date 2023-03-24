import { ChainId, FungibleToken } from '../type'
import urlcat from 'urlcat'
import { toChecksumAddress } from 'web3-utils'
import { generateLogoURL } from '../utils/asset'
import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer'

export function convertEnumToArray(e: any) {
  return Object.keys(e)
    .filter((v) => isNaN(Number(v)))
    .map((key) => {
      return {
        key,
        value: e[key as keyof typeof e],
      }
    })
}

export const explorerPagesMapping: Partial<Record<ChainId, string[]>> = {
  [ChainId.Mainnet]: [],
  [ChainId.BNB]: [],
  [ChainId.Polygon]: [],
  [ChainId.Arbitrum]: [],
  [ChainId.Avalanche]: [],
  [ChainId.Fantom]: [],
  [ChainId.xDai]: [],
  [ChainId.Aurora]: ['https://explorer.aurora.dev/tokens'],
  // [ChainId.Optimistic]: 'https://optimistic.etherscan.io',
}

export const explorerBasURLMapping: Partial<Record<ChainId, string>> = {
  [ChainId.Mainnet]: 'https://etherscan.io',
  [ChainId.BNB]: 'https://bscscan.com',
  [ChainId.Polygon]: 'https://polygonscan.com',
  [ChainId.Arbitrum]: 'https://arbiscan.io',
  [ChainId.Avalanche]: 'https://snowtrace.io',
  [ChainId.Fantom]: 'https://ftmscan.com',
  [ChainId.xDai]: 'https://gnosisscan.io',
  [ChainId.Aurora]: 'https://explorer.aurora.dev',
  // [ChainId.Optimistic]: 'https://optimistic.etherscan.io',
}

export const explorerFetchMapping: Partial<Record<ChainId, (url: string) => Promise<FungibleToken[]>>> = {
  [ChainId.Mainnet]: async (url: string) => [],
  [ChainId.BNB]: async (url: string) => [],
  [ChainId.Polygon]: async (url: string) => [],
  [ChainId.Arbitrum]: async (url: string) => [],
  [ChainId.Avalanche]: async (url: string) => [],
  [ChainId.Fantom]: async (url: string) => [],
  [ChainId.xDai]: async (url: string) => [],
  [ChainId.Aurora]: async (url: string) => {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()

    await page.goto(url)
    page.once('load', () => console.log('Page loaded!'))
    await page.setViewport({ width: 1080, height: 1024 })

    const loadingSelector = '.table-content-loader'
    const tableSelector = '.stakes-table-container'
    await page.waitForSelector(loadingSelector, { hidden: true })
    const tableElementHandler = await page.waitForSelector(tableSelector)
    const tableElement = await tableElementHandler?.evaluate((x) => x.innerHTML)
    await browser.close()
    const q = cheerio.load(tableElement ?? '')
    const table = q('table tbody tr').map((_, x) => x)
    let results: FungibleToken[] = []

    for (const x of table) {
      const fullName = q('[data-test="token_link"]', x).text()
      if (!fullName) continue

      const pageLink = q('[data-test="token_link"]', x).attr('href')
      if (!pageLink) continue

      const address = toChecksumAddress(pageLink?.replace('/token/', ''))
      if (!address) continue

      const decimals = 18

      const token = {
        chainId: ChainId.Aurora,
        address: address,
        name: fullName.replace(/ \(.*\)/g, ''),
        symbol:
          fullName
            .match(/\(.*\)$/g)?.[0]
            ?.replace('(', '')
            .replace(')', '') ?? '',
        decimals: decimals,
        logoURI: generateLogoURL(ChainId.Aurora, address),
        originLogoURI: '',
      }

      results.push(token)
    }
    return results
  },
  // [ChainId.Optimistic]: (url: string) => '',
}
