import axios from 'axios'
import { ChainId, FungibleToken, Provider, Providers } from '../type'
import urlcat from 'urlcat'
import { differenceBy, some, uniqBy } from 'lodash'
import { generateLogoURL } from '../utils/asset'
import { toChecksumAddress } from 'web3-utils'
import { delay } from '../utils'

export const baseURL = 'https://api.coingecko.com/api/v3'

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
}

interface Platform {
  id: string
  chain_identifier: number
  name: string
}

export class CoinGecko implements Provider {
  getProviderName(): Providers {
    return Providers.coinGeoko
  }
  private async getCurrentChainPlatformId(chainId: ChainId) {
    const requestURL = urlcat(baseURL, 'asset_platforms')
    const result = await axios.get<Platform[]>(requestURL)
    return result.data.find((x) => x.chain_identifier === chainId)?.id
  }

  private async getMarketsCoins(chainId: ChainId) {
    const result: CoinInfo[] = []
    while (result.length < 100) {
      const requestURL = urlcat(baseURL, '/coins/markets', {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        category: idsMapping[chainId],
        per_page: 250,
        page: Math.ceil(result.length / 250),
      })
      const list = await axios.get<Coin[]>(requestURL)

      if (!list.data.length) break

      result.push(
        ...list.data.map((x) => ({
          id: x.id,
          symbol: x.symbol,
          name: x.name,
          logoURI: x.image,
        })),
      )

      await delay(6000)
    }

    return result
  }

  private async getCoinDetail(id: string, platformId: string) {
    const requestURL = urlcat(baseURL, '/coins/:id', {
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
    const topList = await this.getMarketsCoins(chainId)
    // for saving api request times
    const toAddList = differenceBy(uniqBy(topList, 'id'), exclude, (x) =>
      some(exclude, (e) => e.symbol.toLowerCase() === x.symbol.toLowerCase()),
    )
    console.log(`The total tokens length: is: ${topList.length}`)
    console.log(`The difference tokens length: is: ${toAddList.length}`)

    const platformId = await this.getCurrentChainPlatformId(chainId)
    await delay(6000)

    const result: FungibleToken[] = []
    for (const token of toAddList) {
      if (token.symbol === 'eth') continue
      if (!platformId) continue

      const detail = await this.getCoinDetail(token.id, platformId)
      if (!detail) continue
      if (detail.contract_address === '') continue

      result.push({
        chainId,
        address: toChecksumAddress(detail.contract_address),
        name: token.name,
        symbol: token.symbol,
        decimals: detail.decimal_place,
        logoURI: generateLogoURL(chainId, detail.contract_address),
        originLogoURI: token.logoURI,
      })
      await delay(6000)
    }
    return [...result, ...exclude].filter(
      (x) => x.address && topList.find((e) => e.symbol.toLowerCase() === x.symbol.toLowerCase()),
    )
  }

  isSupportChain(chainId: ChainId): boolean {
    return !!idsMapping[chainId]
  }
}
