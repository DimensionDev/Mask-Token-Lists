import { ChainId, FungibleToken } from './type'
import { CoinGecko } from './providers/coingecko'
import urlcat from 'urlcat'
import axios from 'axios'
import { outputDir, writeTokensToFile } from './utils'
import fs from 'node:fs/promises'
import * as process from 'process'
import { sortBy, uniqBy } from 'lodash'
import { toChecksumAddress } from 'web3-utils'

const coinGeckoAPI = new CoinGecko()
const providers = [coinGeckoAPI]

const TOKEN_LIST_BASE_URL = 'https://tokens.r2d2.to/'

async function getLatestReleaseTokenList(chainId: ChainId) {
  const requestURL = urlcat(TOKEN_LIST_BASE_URL, 'latest/:chainId/tokens.json', { chainId })
  const listInfo = await axios.get<{ tokens: FungibleToken[] }>(requestURL)
  return listInfo.data.tokens
}

async function init() {
  await fs.rmdir(outputDir, { recursive: true })
  await fs.mkdir(outputDir)
}

// Open pull request for assets and token list
async function main() {
  // await init()

  const chains = Object.values(ChainId).filter((v) => !isNaN(Number(v))) as ChainId[]
  for (const chain of chains) {
    const latestReleaseTokenList = await getLatestReleaseTokenList(chain)
    let result: FungibleToken[] = []
    if (chain == ChainId.Mainnet) {
      for (const p of providers) {
        console.log(`Fetching the chain: ${chain} tokens from ${p.getProviderName()}...`)
        if (p.isSupportChain(chain as ChainId)) {
          const tokens = await p.generateFungibleTokens(chain, latestReleaseTokenList)
          result = [...result, ...tokens]
        }
      }
    }

    await writeTokensToFile(
      chain,
      sortBy(
        uniqBy(result, (x) => toChecksumAddress(x.address)),
        'symbol',
      ),
    )
  }

  console.log('Generate success!')
  process.exit(0)
}

main()
