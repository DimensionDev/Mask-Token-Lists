import { ChainId, FungibleToken } from '../../type'
import { toChecksumAddress } from 'web3-utils'
import { createFungibleToken } from '../createFungibleToken'
import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer-extra'
import { executablePath } from 'puppeteer'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())

export async function fetchETH(url: string) {
  const browser = await puppeteer.launch({ executablePath: executablePath(), timeout: 1000000 })
  const page = await browser.newPage()
  await page.goto(url)
  page.once('load', () => console.log('ETH Page loaded!'))
  page.once('error', (error) => console.log('Failed to load ETH Page!', error))
  await page.setViewport({ width: 1080, height: 1024 })

  const tableSelector = '#ContentPlaceHolder1_tblErc20Tokens'
  const tableElementHandler = await page.waitForSelector(tableSelector)
  const tableElement = await tableElementHandler?.evaluate((x) => x.innerHTML)

  await browser.close()
  const q = cheerio.load(tableElement ?? '')
  const table = q('table tbody tr').map((_, x) => x)
  let results: FungibleToken[] = []

  for (const x of table) {
    const logo = q('img', x).attr('src')
    const fullName = q('td a .hash-tag', x).text() + ' ' + q('td a .text-muted', x).text()
    if (!fullName) continue

    const pageLink = q('td a', x).attr('href')
    if (!pageLink) continue

    const address = toChecksumAddress(pageLink?.replace('/token/', ''))
    if (!address) continue

    results.push(createFungibleToken(ChainId.Mainnet, address, fullName, 18, logo ? `https://etherscan.io${logo}` : ''))
  }
  return results
}
