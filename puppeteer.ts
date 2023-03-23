import puppeteer from 'puppeteer'
import * as cheerio from 'cheerio'

;(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  page.once('load', () => console.log('Page loaded!'))
  await page.goto('https://developer.chrome.com/')

  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 })

  // Type into search box
  await page.type('.search-box__input', 'automate beyond recorder')

  // console.log({ data })
  // Wait and click on first result
  const searchResultSelector = '.hero-card__inner'
  const x = await page.waitForSelector(searchResultSelector)
  // await page.click(searchResultSelector);
  const textContent = await x?.evaluate((x) => x.innerHTML)

  console.log(textContent)

  // Locate the full title with a unique string
  const textSelector = await page.waitForSelector('text/Customize and automate')
  const fullTitle = await textSelector?.evaluate((el) => el.textContent)

  // Print the full title
  console.log('The title of this blog post is "%s".', fullTitle)

  await browser.close()
})()
