import { ChainId } from '../type'
import axios from 'axios'
import urlcat from 'urlcat'
import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer-extra'
import { executablePath } from 'puppeteer'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())

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
  [ChainId.Aurora]: 'https://aurorascan.dev',
  // [ChainId.Optimistic]: 'https://optimistic.etherscan.io',
}

export async function fetchExplorerPage(url: string) {
  if (url.startsWith(explorerBasURLMapping[ChainId.Optimistic]!)) {
    puppeteer.use(StealthPlugin())
    const browser = await puppeteer.launch({ executablePath: executablePath(), timeout: 1000000 })
    const page = await browser.newPage()

    await page.goto(url, { waitUntil: 'networkidle0' })
    await page.waitForSelector('#navBar')
    const data = await page.$('body')
    await browser.close()

    return data
  } else {
    const { data } = await axios.get(url, {
      headers: {
        accept: requestAcceptHeader,
        'user-agent': userAgent,
      },
    })
    return data
  }
}

const requestAcceptHeader =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
const userAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'

export async function getTokenDecimals(chainId: ChainId, address: string) {
  const baseURL = explorerBasURLMapping[chainId]
  if (!baseURL) return
  const link = urlcat(baseURL, 'token/:address', { address })
  const data = await fetchExplorerPage(link)

  const q = cheerio.load(data)
  const decimals = q('#ContentPlaceHolder1_trDecimals .row div:nth-child(2)').text()

  return parseInt(decimals)
}
