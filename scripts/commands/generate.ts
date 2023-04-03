import { ChainId, FungibleToken } from '../type'
import { writeTokensToFile } from '../utils'
import { blockedTokenAddressMapping } from '../utils/blockedTokenAddressMapping'
import { sortBy, uniqBy } from 'lodash'
import { prefetchCryptoRankCoins } from '../cache/cryptorank/batch'
import { CryptoRank } from '../providers/cryptoRank'
import { CoinMarketCap } from '../providers/coinmarketcap'
import { SubScan } from '../providers/subScan'
import urlcat from 'urlcat'
import axios from 'axios'
import { CoinGecko } from '../providers/coingecko'
import { Explorer } from '../providers/explorer'
import { SolanaFm } from '../providers/solanaFm'
import { isSameAddress } from '../utils/helpers'

const coinGeckoAPI = new CoinGecko()
const explorerAPI = new Explorer()
const cryptoRankAPI = new CryptoRank()
const coinMarketCapAPI = new CoinMarketCap()
const subScanAPI = new SubScan()
const SolanaFmAPI = new SolanaFm()

const providers = [coinGeckoAPI, explorerAPI, coinMarketCapAPI, subScanAPI, cryptoRankAPI, SolanaFmAPI]

const TOKEN_LIST_BASE_URL = 'https://tokens.r2d2.to/'

async function getLatestReleasedTokenList(chainId: ChainId) {
  const requestURL = urlcat(TOKEN_LIST_BASE_URL, 'latest/:chainId/tokens.json', { chainId })
  try {
    const listInfo = await axios.get<{ tokens: FungibleToken[] }>(requestURL)
    return listInfo.data.tokens
  } catch (e) {
    console.log(`fetch latest released token list failed(chainId: ${chainId})`)
    return []
  }
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
      const tokens = sortBy(
        uniqBy([...latestReleaseTokenList, ...result], (x) => x.address.toLowerCase()),
        'symbol',
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
      await writeTokensToFile(chain, tokens)
    }
  }

  console.log('Generate success!')
  process.exit(0)
}
