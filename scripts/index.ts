import { ChainId, FungibleToken } from './type'
import { CoinGecko } from './providers/coingecko'
import urlcat from 'urlcat'
import axios from 'axios'
import { distDir, writeTokenInfoToArtifact, writeTokensToFile } from './utils'
import * as fs from 'node:fs/promises'
import * as process from 'process'
import { sortBy, uniqBy } from 'lodash'
import { toChecksumAddress } from 'web3-utils'
import { Explorer } from './providers/explorer'
import { CryptoRank } from './providers/cryptoRank'
import { CoinMarketCap } from './providers/coinmarketcap'

const coinGeckoAPI = new CoinGecko()
const explorerAPI = new Explorer()
const cryptoRankAPI = new CryptoRank()
const coinMarketCapAPI = new CoinMarketCap()

const providers = [coinMarketCapAPI]

const TOKEN_LIST_BASE_URL = 'https://tokens.r2d2.to/'

async function getLatestReleaseTokenList(chainId: ChainId) {
  const requestURL = urlcat(TOKEN_LIST_BASE_URL, 'latest/:chainId/tokens.json', { chainId })
  const listInfo = await axios.get<{ tokens: FungibleToken[] }>(requestURL)
  return listInfo.data.tokens
}

async function init() {
  await fs.mkdir(distDir)
}

// TODO: should use multi-thread
async function main() {
  await init()

  const chains = Object.values(ChainId).filter((v) => !isNaN(Number(v))) as ChainId[]

  for (const chain of chains) {
    const latestReleaseTokenList = await getLatestReleaseTokenList(chain)
    let result: FungibleToken[] = []
    if (chain == ChainId.Mainnet) {
      for (const p of providers) {
        console.log(`Fetching the chain: ${chain} tokens from ${p.getProviderName()}...`)
        if (p.isSupportChain(chain as ChainId)) {
          try {
            const tokens = await p.generateFungibleTokens(chain, latestReleaseTokenList)
            result = [...result, ...tokens]
          } catch (e) {
            console.log(`Fetch the chain failed`)
            console.log(e)
          }
        }
      }
    }

    if (result.length) {
      await writeTokensToFile(
        chain,
        sortBy(
          uniqBy(result, (x) => toChecksumAddress(x.address)),
          'symbol',
        ),
      )
      await writeTokenInfoToArtifact(
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
