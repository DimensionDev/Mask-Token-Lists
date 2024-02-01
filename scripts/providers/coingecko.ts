import axios from 'axios'
import { ChainId, FungibleToken, Provider, ProviderType } from '../type'
import urlcat from 'urlcat'
import { differenceBy, some, uniqBy } from 'lodash'
import { generateLogoURL } from '../utils/asset'
import { toChecksumAddress } from 'web3-utils'
import { delay } from '../utils'
import getConfig from '../config'
import { COINGECKO_PROXY_URL } from '../config/urls'

interface Coin {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  fully_diluted_valuation: number
  total_volume: number
  high_24h: number
  low_24h: number
  price_change_24h: number
  price_change_percentage_24h: number
  market_cap_change_24h: number
  market_cap_change_percentage_24h: number
  circulating_supply: number
  total_supply: number
  max_supply: number
  ath: number
  ath_change_percentage: number
  ath_date: Date
  atl: number
  atl_change_percentage: number
  atl_date: Date
  roi?: any
  last_updated: Date
}

interface CoinInfo {
  id: string
  symbol: string
  name: string
  logoURI: string
}

interface CoinDetail {
  id: string
  symbol: string
  name: string
  asset_platform_id: string
  platforms: string
  detail_platforms: Record<
    string,
    {
      decimal_place: number
      contract_address: string
    }
  >
}

const idsMapping: Partial<Record<ChainId, string>> = {
  [ChainId.Mainnet]: 'ethereum-ecosystem',
  [ChainId.Kardiachain]: 'kardiachain-ecosystem',
  [ChainId.BNB]: 'binance-smart-chain',
  [ChainId.Heco]: 'heco-chain-ecosystem',
  [ChainId.Polygon]: 'polygon-ecosystem',
  [ChainId.Arbitrum]: 'arbitrum-ecosystem',
  [ChainId.Avalanche]: 'avalanche-ecosystem',
  [ChainId.xDai]: 'xdai-ecosystem',
  [ChainId.Fantom]: 'fantom-ecosystem',
  [ChainId.Cronos]: 'cronos-ecosystem',
  [ChainId.Metis]: 'metis-ecosystem',
  [ChainId.Moonbeam]: 'moonbeam-ecosystem',
  [ChainId.Moonriver]: 'moonriver-ecosystem',
  [ChainId.Celo]: 'celo-ecosystem',
  [ChainId.Harmony]: 'harmony-ecosystem',
  [ChainId.Optimistic]: 'optimism-ecosystem',
}

interface Platform {
  id: string
  chain_identifier: number
  name: string
}

const { TOTAL, COIN_GEOKO_PAGE_SIZE, PROXY_WAIT_TIME } = getConfig()

export class CoinGecko implements Provider {
  getProviderType(): ProviderType {
    return ProviderType.CoinGeoko
  }

  private async getCurrentChainPlatformId(chainId: ChainId) {
    const requestURL = urlcat(COINGECKO_PROXY_URL, 'asset_platforms')
    const result = await axios.get<Platform[]>(requestURL)
    return result.data.find((x) => x.chain_identifier === chainId)?.id
  }

  private async getMarketsCoins(chainId: ChainId) {
    const result: CoinInfo[] = []
    while (result.length < TOTAL) {
      const requestURL = urlcat(COINGECKO_PROXY_URL, '/coins/markets', {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        category: idsMapping[chainId],
        per_page: 250,
        page: Math.ceil(result.length / COIN_GEOKO_PAGE_SIZE),
      })
      const list = await axios.get<Coin[]>(requestURL)

      console.log(
        `Fetched the ${result.length / COIN_GEOKO_PAGE_SIZE} page date, the list length is: ${list.data.length}`,
      )

      if (!list.data.length) break

      result.push(
        ...list.data.map((x) => ({
          id: x.id,
          symbol: x.symbol,
          name: x.name,
          logoURI: x.image,
        })),
      )
      if (list.data.length < COIN_GEOKO_PAGE_SIZE) break

      await delay(PROXY_WAIT_TIME)
    }

    return result
  }

  private async getCoinDetail(id: string, platformId: string) {
    const requestURL = urlcat(COINGECKO_PROXY_URL, '/coins/:id', {
      id,
      market_data: false,
      tickers: false,
      community_data: false,
      developer_data: false,
      sparkline: false,
      localization: false,
    })

    try {
      const info = await axios.get<CoinDetail>(requestURL)
      return info.data.detail_platforms[platformId]
    } catch {
      return
    }
  }

  async generateFungibleTokens(chainId: ChainId, exclude: FungibleToken[]): Promise<FungibleToken[]> {
    const top1000List = await this.getMarketsCoins(chainId)
    // for saving api request times
    const toAddList = differenceBy(uniqBy(top1000List, 'id'), exclude, (x) =>
      some(exclude, (e) => e.symbol.toLowerCase() === x.symbol.toLowerCase()),
    )

    console.log(`The total tokens length: is: ${top1000List.length}`)
    console.log(`The difference tokens length: is: ${toAddList.length}`)

    const platformId = await this.getCurrentChainPlatformId(chainId)
    await delay(PROXY_WAIT_TIME)

    const result: FungibleToken[] = []
    for (const token of toAddList) {
      if (token.symbol === 'eth') continue
      if (!platformId) continue

      const detail = await this.getCoinDetail(token.id, platformId)
      if (!detail) continue
      if (detail.contract_address === '') continue
      if (!detail.decimal_place) continue

      try {
        result.push({
          chainId,
          address: toChecksumAddress(detail.contract_address),
          name: token.name,
          symbol: token.symbol,
          decimals: detail.decimal_place,
          logoURI: generateLogoURL(chainId, detail.contract_address),
          originLogoURI: token.logoURI,
        })
      } catch (e) {
        console.log(`Format token ${token.symbol} failed:`)
        console.log(e)
      }

      await delay(PROXY_WAIT_TIME)
    }
    return [...result, ...exclude].filter(
      (x) => x.address && top1000List.find((e) => e.symbol.toLowerCase() === x.symbol.toLowerCase()),
    )
  }

  isSupportChain(chainId: ChainId): boolean {
    return !!idsMapping[chainId]
  }
}
