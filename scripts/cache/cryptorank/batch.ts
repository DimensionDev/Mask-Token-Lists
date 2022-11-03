import * as fs from 'node:fs/promises'
import { pick } from 'lodash'

// data source: https://api.cryptorank.io/v0/coins
async function main() {
  const content = await fs.readFile('./cryptoRankCoinsCache.json', { encoding: 'utf-8' })
  const contentJSON = JSON.parse(content)
  const result = []

  for (const contentJSONElement of contentJSON) {
    result.push(pick(contentJSONElement, ['rank', 'key', 'name', 'symbol', 'type', 'image', 'tokens']))
  }

  await fs.writeFile('./data.json', JSON.stringify(result))
}

main()
