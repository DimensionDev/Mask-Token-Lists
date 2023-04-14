import { ChainId, FungibleToken } from '../../type'
import { toChecksumAddress } from 'web3-utils'
import { createFungibleToken } from '../createFungibleToken'
import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer-extra'
import { executablePath } from 'puppeteer'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())

export async function fetchConflux(url: string) {
  const browser = await puppeteer.launch({ executablePath: executablePath(), timeout: 1000000 })
  const page = await browser.newPage()
  await page.goto(url)
  page.once('load', () => console.log('Conflux Page loaded!'))
  page.once('error', (error) => console.log('Failed to load Conflux Page!', error))
  await page.setViewport({ width: 1080, height: 1024 })

  const tableSelector = '.ant-table-content'
  const tableElementHandler = await page.waitForSelector(tableSelector)
  const tableElement = await tableElementHandler?.evaluate((x) => x.innerHTML)

  await browser.close()
  const q = cheerio.load(tableElement ?? '')
  const table = q('table tbody .ant-table-row').map((_, x) => x)
  let results: FungibleToken[] = []

  for (const x of table) {
    const logo = q('td:nth-child(2) img', x).attr('src')
    const fullName = q('td:nth-child(2) a span', x).text()
    if (!fullName) continue

    const pageLink = q('td:nth-child(2) a', x).attr('href')
    if (!pageLink) continue

    const address = toChecksumAddress(pageLink?.replace('/token/', ''))
    if (!address) continue

    const rank = q('td:first-child', x).text()

    results.push(
      createFungibleToken(ChainId.Conflux, address, fullName, 18, logo ?? '', rank ? Number(rank) : undefined),
    )
  }
  return results
}
