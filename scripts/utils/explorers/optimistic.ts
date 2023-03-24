import { ChainId, FungibleToken } from '../../type'
import { toChecksumAddress } from 'web3-utils'
import { createFungibleToken } from '../createFungibleToken'
import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer'

export async function fetchOptimistic(url: string) {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  await page.goto(url)
  page.once('load', () => console.log('Optimistic Page loaded!'))
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

    results.push(
      createFungibleToken(ChainId.Aurora, address, fullName, 18, logo ? `https://optimistic.etherscan.io${logo}` : ''),
    )
  }
  return results
}
