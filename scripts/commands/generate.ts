import { ChainId, FungibleToken } from '../type'
import { writeTokensToFile } from '../utils'
import { toChecksumAddress } from 'web3-utils'
import { sortBy, uniqBy } from 'lodash'
import { prefetchCryptoRankCoins } from '../cache/cryptorank/batch'
import { CryptoRank } from '../providers/cryptoRank'
import { CoinMarketCap } from '../providers/coinmarketcap'
import { SubScan } from '../providers/subScan'
import urlcat from 'urlcat'
import axios from 'axios'
import { CoinGecko } from '../providers/coingecko'
import { Explorer } from '../providers/explorer'

const coinGeckoAPI = new CoinGecko()
const explorerAPI = new Explorer()
const cryptoRankAPI = new CryptoRank()
const coinMarketCapAPI = new CoinMarketCap()
const subScanAPI = new SubScan()

const providers = [coinGeckoAPI, explorerAPI, coinMarketCapAPI, subScanAPI, cryptoRankAPI]

const TOKEN_LIST_BASE_URL = 'https://tokens.r2d2.to/'

async function getLatestReleasedTokenList(chainId: ChainId) {
  const requestURL = urlcat(TOKEN_LIST_BASE_URL, 'latest/:chainId/tokens.json', { chainId })
  const listInfo = await axios.get<{ tokens: FungibleToken[] }>(requestURL)
  return listInfo.data.tokens
}

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

    console.log(`The current chain get ${result.length} tokens`, { result })

    if (result.length) {
      await writeTokensToFile(
        chain,
        sortBy(
          uniqBy([...latestReleaseTokenList, ...result], (x) => toChecksumAddress(x.address)),
          'symbol',
        ).filter((x) => x.address && x.symbol && x.chainId && x.decimals && x.name),
      )
    }
  }

  console.log('Generate success!')
  process.exit(0)
}
