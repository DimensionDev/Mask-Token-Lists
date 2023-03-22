export interface CMCTokenInfo {
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
  quotes: CMCQuote[]
  isAudited: boolean
  auditInfoList: CMCAuditInfoList[]
}

export interface CMCQuote {
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

export interface CMCAuditInfoList {
  coinId: string
  auditor: string
  auditStatus: number
  reportUrl: string
}

export interface CMCResponse {
  data: {
    cryptoCurrencyList: CMCTokenInfo[]
  }
}

export interface CMCIDInfo {
  id: number
  name: string
  symbol: string
  slug: string
  rank: number
  displayTV: number
  is_active: number
  first_historical_data: string
  last_historical_data: string
  platform: CMCPlatform
}

export interface CMCPlatform {
  id: number
  name: string
  symbol: string
  slug: string
  token_address: string
}

export type CMCMetadata = {
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
