import { ChainId, FungibleToken } from '../../type'
import { toChecksumAddress } from 'web3-utils'
import { createFungibleToken } from '../createFungibleToken'
import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer'

export async function fetchAurora(url: string) {
  const browser = await puppeteer.launch()
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

    results.push(createFungibleToken(ChainId.Aurora, address, fullName, 1, ''))
  }
  return results
}

export async function fetchAuroraForTokenDecimal(url: string): Promise<number> {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  console.log({ url })
  await page.goto(url)
  await page.setViewport({ width: 1080, height: 1024 })
  await browser.close()
  return 16
}
