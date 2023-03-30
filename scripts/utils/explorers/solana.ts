import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { Browser } from 'puppeteer'

puppeteer.use(StealthPlugin())

export async function fetchSolanaForTokenDecimal(url: string, browser: Browser): Promise<number> {
  const page = await browser.newPage()
  const status = await page.goto(url)
  console.log({ url, code: status?.status() })
  page.once('load', () => console.log('Solana Page loaded!'))
  page.once('error', (error) => console.log('Failed to Solana Page load!', error))
  await page.setViewport({ width: 1080, height: 1024 })
  const cardSelector = '.card:first-child div div'
  const cardLoadingSelector = '.card:first-child div div.placeholder-glow'
  const cardItemLoadingSelector = '.card .placeholder'
  const tokenLoadingSelector = '.card:first-child .spinner-grow'
  const decimalsFullPathSelector = '.card:first-child div div .gap-4:nth-child(2) span'
  const decimalsSelector = 'span'
  await page.waitForSelector(cardLoadingSelector, { hidden: true })
  await page.waitForSelector(tokenLoadingSelector, { hidden: true })
  await page.waitForSelector(cardItemLoadingSelector, { hidden: true })
  await page.waitForSelector(cardItemLoadingSelector, { hidden: true })
  await page.waitForSelector(decimalsFullPathSelector)
  const cardElementHandler = await page.waitForSelector(cardSelector)
  const cardElement = await cardElementHandler?.evaluate((x) => x.innerHTML)
  console.log({ cardElement })
  const q = cheerio.load(cardElement ?? '')
  const card = q('.gap-4:nth-child(2)')
  const decimals = Number(q(decimalsSelector, card).text().trim())
  console.log({ decimals: q(decimalsSelector, card).text() })
  return decimals
}
