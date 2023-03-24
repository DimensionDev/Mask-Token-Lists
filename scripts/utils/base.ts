import { ChainId } from '../type'
import urlcat from 'urlcat'
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

export async function fetchExplorerPage(url: string) {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  await page.goto(url)
  page.once('load', () => console.log('Page loaded!'))
  await page.setViewport({ width: 1080, height: 1024 })

  const loadingSelector = '.table-content-loader'
  const tableSelector = '.top-tokens-list'
  await page.waitForSelector(loadingSelector, { hidden: true })
  const tableElementHandler = await page.waitForSelector(tableSelector, { hidden: true })
  const tableElement = await tableElementHandler?.evaluate((x) => x.innerHTML)
  console.log({ tableElement })
  await browser.close()

  return tableElement ?? ''
}
export async function getTokenDecimals(chainId: ChainId, address: string) {
  const baseURL = explorerBasURLMapping[chainId]
  if (!baseURL) return
  const link = urlcat(baseURL, 'token/:address', { address })
  const data = await fetchExplorerPage(link)

  const q = cheerio.load(data)
  const decimals = q('#ContentPlaceHolder1_trDecimals .row div:nth-child(2)').text()

  return parseInt(decimals)
}
