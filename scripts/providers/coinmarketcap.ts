import { ChainId, FungibleToken, Provider, Providers } from '../type'
import axios from 'axios'
import urlcat from 'urlcat'
import { differenceBy, pick, some, uniqBy } from 'lodash'
import { delay } from '../utils'
import { toChecksumAddress } from 'web3-utils'
import { generateLogoURL } from '../utils/asset'
import { getTokenDecimals } from '../utils/base'
import getConfig from '../config'

export interface TokenInfo {
  id: number
  name: string
  symbol: string
  slug: string
  cmcRank: number
  marketPairCount: number
  circulatingSupply: number
  selfReportedCirculatingSupply: number
  totalSupply: number
  ath: number
  atl: number
  high24h: number
  low24h: number
  isActive: number
  lastUpdated: string
  dateAdded: string
  quotes: Quote[]
  isAudited: boolean
  auditInfoList: AuditInfoList[]
}

export interface Quote {
  name: string
  price: number
  volume24h: number
  volume7d: number
  volume30d: number
  marketCap: number
  selfReportedMarketCap: number
  percentChange1h: number
  percentChange24h: number
  percentChange7d: number
  lastUpdated: string
  percentChange30d: number
  percentChange60d: number
  percentChange90d: number
  fullyDilluttedMarketCap: number
  marketCapByTotalSupply: number
  dominance: number
  turnover: number
  ytdPriceChangePercentage: number
}

export interface AuditInfoList {
  coinId: string
  auditor: string
  auditStatus: number
  reportUrl: string
}

export interface Response {
  data: {
    cryptoCurrencyList: TokenInfo[]
  }
}

export interface IDInfo {
  id: number
  name: string
  symbol: string
  slug: string
  rank: number
  displayTV: number
  is_active: number
  first_historical_data: string
  last_historical_data: string
  platform: Platform
}

export interface Platform {
  id: number
  name: string
  symbol: string
  slug: string
  token_address: string
}

export type Metadata = {
  id: number
  name: string
  symbol: string
  category: string
  description: string
  slug: string
  logo: string
  subreddit: string
  notice: string
  tags: Array<string>
  'tag-names': Array<string>
  'tag-groups': Array<string>
  urls: {
    website: Array<string>
    twitter: Array<any>
    message_board: Array<string>
    chat: Array<any>
    facebook: Array<any>
    explorer: Array<string>
    reddit: Array<string>
    technical_doc: Array<string>
    source_code: Array<string>
    announcement: Array<any>
  }
  platform: any
  date_added: string
  twitter_username: string
  is_hidden: number
  date_launched: any
  contract_address: Array<any>
  self_reported_circulating_supply: any
  self_reported_tags: any
  self_reported_market_cap: any
}

const PlatformMapping: Partial<Record<ChainId, string>> = {
  [ChainId.Mainnet]: 'ethereum-ecosystem',
  [ChainId.BNB]: 'binance-smart-chain',
  [ChainId.Polygon]: 'polygon-ecosystem',
  [ChainId.Avalanche]: 'avalanche-ecosystem',
  [ChainId.Arbitrum]: 'arbitrum-ecosytem',
}

const baseURL = 'https://api.coinmarketcap.com'
const baseProURL = 'https://pro-api.coinmarketcap.com'

const { TOTAL, CMC_WAIT_TIME } = getConfig()

export class CoinMarketCap implements Provider {
  async getIdMapping() {
    let start: number | undefined = 1
    let result: { id: number; name: string; symbol: string; token_address: string }[] = []
    while (start) {
      const url = urlcat(baseProURL, '/v1/cryptocurrency/map', {
        start,
        limit: 2000,
      })

      const res = await axios.get<{ data: IDInfo[] }>(url, {
        headers: { 'X-CMC_PRO_API_KEY': 'bd92d128-3883-45a7-8d45-fb565544f40a' },
      })
      if (res.data.data.length) {
        result = [
          ...result,
          ...res.data.data.map(
            (x) =>
              pick(x, 'id', 'name', 'symbol', 'platform.token_address') as {
                id: number
                name: string
                symbol: string
                token_address: string
              },
          ),
        ]
        start += 2000
        await delay(500)
      } else {
        start = undefined
        break
      }
    }

    return result
  }

  async getMetadatas(ids: number[]) {
    const url = urlcat(baseProURL, '/v2/cryptocurrency/info', { id: ids.join() })
    const res = await axios.get<{ data: Record<number, Metadata> }>(url, {
      headers: { 'X-CMC_PRO_API_KEY': 'bd92d128-3883-45a7-8d45-fb565544f40a' },
    })

    return Object.values(res.data.data)
  }

  async generateFungibleTokens(chainId: ChainId, exclude: FungibleToken[]): Promise<FungibleToken[]> {
    const url = urlcat(baseURL, '/data-api/v3/cryptocurrency/listing', {
      start: 1,
      limit: TOTAL,
      sortBy: 'market_cap',
      sortType: 'desc',
      cryptoType: 'all',
      tagType: 'all',
      audited: 'false',
      aux: 'ath,atl,high24h,low24h,num_market_pairs,cmc_rank,date_added,max_supply,circulating_supply,total_supply,volume_7d,volume_30d,self_reported_circulating_supply,self_reported_market_cap',
      tagSlugs: PlatformMapping[chainId],
    })
    const list = await axios.get<Response>(url)
    const topList = list.data.data.cryptoCurrencyList
      .map((x) => pick(x, 'id', 'name', 'symbol'))
      .filter((x) => x.symbol !== 'ETH')
    const toAddList = differenceBy(uniqBy(topList, 'id'), exclude, (x) =>
      some(exclude, (e) => e.symbol.toLowerCase() === x.symbol.toLowerCase()),
    )
    const metadatas = await this.getMetadatas(toAddList.map((x) => x.id))
    const idMapping = await this.getIdMapping()

    const toAddTokenList: FungibleToken[] = toAddList
      .map((x) => {
        const metadata = metadatas.find((t) => t.symbol.toLowerCase() === x.symbol.toLowerCase())
        const mapping = idMapping.find((t) => t.symbol.toLowerCase() === x.symbol.toLowerCase())
        if (!mapping || !metadata || !mapping.token_address) return

        return {
          chainId: chainId,
          address: toChecksumAddress(mapping.token_address),
          name: x.name,
          symbol: x.symbol,
          decimals: 0,
          logoURI: generateLogoURL(chainId, toChecksumAddress(mapping.token_address)),
          originLogoURI: metadata.logo,
        }
      })
      .filter((x) => !!x) as FungibleToken[]

    const result: FungibleToken[] = []
    for (const token of toAddTokenList) {
      if (token.symbol === 'eth') continue

      const decimals = await getTokenDecimals(chainId, token.address)
      if (!decimals) continue

      result.push({
        ...token,
        decimals: decimals,
      })
      await delay(CMC_WAIT_TIME)
    }

    return [...result, ...exclude].filter(
      (x) => x.address && topList.find((e) => e.symbol.toLowerCase() === x.symbol.toLowerCase()),
    )
  }

  getProviderName(): Providers {
    return Providers.coinMarketCap
  }

  isSupportChain(chainId: ChainId): boolean {
    return !!PlatformMapping[chainId]
  }
}
