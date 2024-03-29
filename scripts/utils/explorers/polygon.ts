import { ChainId, FungibleToken } from '../../type'
import { toChecksumAddress } from 'web3-utils'
import { createFungibleToken } from '../createFungibleToken'
import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer-extra'
import { executablePath } from 'puppeteer'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { Browser } from 'puppeteer'

puppeteer.use(StealthPlugin())

export async function fetchPolygon(url: string) {
  const browser = await puppeteer.launch({ executablePath: executablePath(), timeout: 1000000 })
  const page = await browser.newPage()
  await page.goto(url)
  page.once('load', () => console.log('Polygon Page loaded!'))
  page.once('error', (error) => console.log('Failed to Polygon Page load!', error))
  await page.setViewport({ width: 1080, height: 1024 })

  const tableSelector = '#ContentPlaceHolder1_divresult'
  const tableElementHandler = await page.waitForSelector(tableSelector)
  const tableElement = await tableElementHandler?.evaluate((x) => x.innerHTML)

  await browser.close()
  const q = cheerio.load(tableElement ?? '')
  const table = q('table tbody tr').map((_, x) => x)
  let results: FungibleToken[] = []

  for (const x of table) {
    const logo = q('img', x).attr('src')
    const fullName = q('.media .media-body a', x).text()
    if (!fullName) continue

    const pageLink = q('.media .media-body a', x).attr('href')
    if (!pageLink) continue

    const address = toChecksumAddress(pageLink?.replace('/token/', ''))
    if (!address) continue

    const rank = q('td:first-child', x).text()

    results.push(
      createFungibleToken(
        ChainId.Polygon,
        address,
        fullName,
        18,
        logo ? `https://polygonscan.com${logo}` : '',
        rank ? Number(rank) : undefined,
      ),
    )
  }
  return results
}

export async function fetchPolygonForTokenDecimal(url: string, browser: Browser): Promise<number> {
  const page = await browser.newPage()
  await page.goto(url)
  await page.setViewport({ width: 1080, height: 1024 })
  const cardSelector = '#ContentPlaceHolder1_trDecimals'
  const decimalsSelector = 'div:nth-child(2)'
  const cardElementHandler = await page.waitForSelector(cardSelector)
  const cardElement = await cardElementHandler?.evaluate((x) => x.innerHTML)
  const q = cheerio.load(cardElement ?? '')
  const card = q('.row')
  const decimals = Number(q(decimalsSelector, card).text().trim())
  return decimals
}
