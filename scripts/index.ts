import { ChainId, FungibleToken } from './type'
import { CoinGecko } from './providers/coingecko'
import urlcat from 'urlcat'
import axios from 'axios'
import { mergeTokenInfoToArtifact, writeTokensToFile } from './utils'
import * as process from 'process'
import { sortBy, uniqBy } from 'lodash'
import { toChecksumAddress } from 'web3-utils'
import { Explorer } from './providers/explorer'
import { CryptoRank } from './providers/cryptoRank'
import { CoinMarketCap } from './providers/coinmarketcap'
import { SubScan } from './providers/subScan'

const coinGeckoAPI = new CoinGecko()
const explorerAPI = new Explorer()
const cryptoRankAPI = new CryptoRank()
const coinMarketCapAPI = new CoinMarketCap()
const subScanAPI = new SubScan()

const providers = [coinGeckoAPI, explorerAPI, cryptoRankAPI, coinMarketCapAPI, subScanAPI]

const TOKEN_LIST_BASE_URL = 'https://tokens.r2d2.to/'

async function getLatestReleaseTokenList(chainId: ChainId) {
  const requestURL = urlcat(TOKEN_LIST_BASE_URL, 'latest/:chainId/tokens.json', { chainId })
  const listInfo = await axios.get<{ tokens: FungibleToken[] }>(requestURL)
  return listInfo.data.tokens
}

async function main() {
  const targetChain = process.argv.slice(2)[0]
  const chains = Object.values(ChainId).filter((v) => !isNaN(Number(v))) as ChainId[]
  const targetChains = targetChain ? [parseInt(targetChain) as ChainId] : chains

  for (const chain of targetChains) {
    console.log(new Array(process.stdout.rows).fill('*').join(''))
    console.log(`The current chain id is: ${chain}`)

    const latestReleaseTokenList = await getLatestReleaseTokenList(chain)
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

    console.log(`The current chain get ${result.length} tokens`)

    if (result.length) {
      await writeTokensToFile(
        chain,
        sortBy(
          uniqBy([...latestReleaseTokenList, ...result], (x) => toChecksumAddress(x.address)),
          'symbol',
        ),
      )

      // Cache the token list info with origin image link for assets repo to fetch image
      await mergeTokenInfoToArtifact(
        chain,
        sortBy(
          uniqBy(result, (x) => toChecksumAddress(x.address)),
          'symbol',
        ),
      )
    }
  }

  console.log('Generate success!')
  process.exit(0)
}

main()
