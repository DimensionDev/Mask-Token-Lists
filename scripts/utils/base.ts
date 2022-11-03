import { ChainId } from '../type'
import axios from 'axios'
import urlcat from 'urlcat'
import * as cheerio from 'cheerio'

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

const basURLMapping: Partial<Record<ChainId, string>> = {
  [ChainId.Mainnet]: 'https://etherscan.io/token',
}

const requestAcceptHeader =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'

// https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
export async function getTokenDecimals(chainId: ChainId, address: string) {
  const baseURL = basURLMapping[chainId]
  if (!baseURL) return
  const link = urlcat(baseURL, ':address', { address })
  const html = await axios.get(link, {
    headers: {
      accept: requestAcceptHeader,
    },
  })
  const q = cheerio.load(html.data)
  const decimals = q('#ContentPlaceHolder1_trDecimals .row div:nth-child(2)').text()
  return parseInt(decimals)
}
