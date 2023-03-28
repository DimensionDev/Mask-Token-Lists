import { ChainId, FungibleToken } from '../../type'
import { toChecksumAddress } from 'web3-utils'
import { createFungibleToken } from '../createFungibleToken'
import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer-extra'
import { executablePath } from 'puppeteer'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { Browser } from 'puppeteer'

puppeteer.use(StealthPlugin())

export async function fetchAurora(url: string) {
  const browser = await puppeteer.launch({ executablePath: executablePath(), timeout: 1000000 })
  const page = await browser.newPage()

  await page.goto(url)
  page.once('load', () => console.log('Aurora Page loaded!'))
  page.once('error', (error) => console.log('Failed to load Aurora Page!', error))
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

    results.push(createFungibleToken(ChainId.Aurora, address, fullName, 0, ''))
  }
  return results
}

export async function fetchAuroraForTokenDecimal(url: string, browser: Browser): Promise<number> {
  const page = await browser.newPage()
  await page.goto(url)
  await page.setViewport({ width: 1080, height: 1024 })
  const cardSelector = '.card:nth-child(1)'
  const decimalsSelector = 'dl:nth-child(6) dd'
  const cardElementHandler = await page.waitForSelector(cardSelector)
  await page.waitForSelector(decimalsSelector)
  const cardElement = await cardElementHandler?.evaluate((x) => x.innerHTML)
  const q = cheerio.load(cardElement ?? '')
  const card = q('.card-body')
  return Number(q(decimalsSelector, card).text().trim())
}
