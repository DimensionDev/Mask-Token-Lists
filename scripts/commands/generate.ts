import { ChainId, FungibleToken } from '../type'
import { writeTokensToFile } from '../utils'
import { blockedTokenAddressMapping } from '../utils/blockedTokenAddressMapping'
import { uniqBy } from 'lodash'
import * as fs from 'node:fs/promises'
import { pick } from 'lodash'
import axios from 'axios'
import { cryptoRankcacheDir } from '../utils/file'
import { CryptoRank } from '../providers/cryptoRank'
import { CoinMarketCap } from '../providers/coinmarketcap'
import { SubScan } from '../providers/subScan'
import { CoinGecko } from '../providers/coingecko'
import { Explorer } from '../providers/explorer'
import { SolanaFm } from '../providers/solanaFm'
import { isSameAddress, getLatestReleasedTokenList } from '../utils/helpers'
import { readTokenInfoFromContract } from './readTokenInfoFromContract'
import { rankByMarketCap } from './rankByMarketCap'

const coinGeckoAPI = new CoinGecko()
const explorerAPI = new Explorer()
const cryptoRankAPI = new CryptoRank()
const coinMarketCapAPI = new CoinMarketCap()
const subScanAPI = new SubScan()
const SolanaFmAPI = new SolanaFm()

const providers = [coinGeckoAPI, explorerAPI, coinMarketCapAPI, subScanAPI, cryptoRankAPI, SolanaFmAPI]

export async function generate(targetChains: ChainId[]) {
  await prefetchCryptoRankCoins()

  for (const chain of targetChains) {
    console.log(new Array(process.stdout.rows).fill('*').join(''))
    console.log(`The current chain id is: ${chain}`)

    const latestReleaseTokenList: FungibleToken[] = await getLatestReleasedTokenList(chain)
    console.log(`This chain has ${latestReleaseTokenList.length} tokens online`)

    let result: FungibleToken[] = []
    for (const p of providers) {
      if (p.isSupportChain(chain as ChainId)) {
        try {
          console.log(`Fetching the chain id is ${chain}'s tokens from ${p.getProviderName()}...`)
          const tokens = await p.generateFungibleTokens(chain, latestReleaseTokenList)

          result = [...result, ...tokens]
        } catch (e) {
          console.log(`Fetch the chain failed by ${p.getProviderName()}`)
          console.log(e)
        }
      }
    }

    const resultReadFromContract = await readTokenInfoFromContract(chain, result)

    if (!resultReadFromContract) return

    console.log(`The current chain get ${resultReadFromContract.length} tokens`, { result: resultReadFromContract })
    if (resultReadFromContract.length) {
      const tokens = uniqBy([...latestReleaseTokenList, ...resultReadFromContract], (x) =>
        x.address.toLowerCase(),
      ).filter((x) => {
        const blockedList = blockedTokenAddressMapping[x.chainId]
        return (
          x.address &&
          x.symbol &&
          x.chainId &&
          x.decimals &&
          x.name &&
          !blockedList?.some((blockedAddress) => isSameAddress(x.address, blockedAddress))
        )
      })

      await writeTokensToFile(chain, await rankByMarketCap(chain, tokens))
    }
  }

  console.log('Generate success!')
  process.exit(0)
}

async function prefetchCryptoRankCoins() {
  console.log('Prefetch CryptoRank Coins from remote.')
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
  console.log(`Prefetched done, the list length is ${result.length}`)
}
