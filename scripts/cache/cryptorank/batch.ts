import * as fs from 'node:fs/promises'
import { pick } from 'lodash'
import axios from 'axios'
import { cryptoRankcacheDir } from '../../utils/file'

export async function prefetchCryptoRankCoins() {
  const res = await axios.get<{ data: any[] }>('https://api.cryptorank.io/v0/coins', {
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json; charset=utf-8',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
    },
  })
  const result = []

  for (const contentJSONElement of res.data.data) {
    result.push(pick(contentJSONElement, ['rank', 'key', 'name', 'symbol', 'type', 'image', 'tokens']))
  }

  await fs.writeFile(`${cryptoRankcacheDir}/data.json`, JSON.stringify(result))
}
