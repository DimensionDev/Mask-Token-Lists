export enum SourceType {
  LEGACY = 'legacy',
  EXPLORER = 'explorer',
  MARKETING = 'marketing',
}

export interface Chain {
  id: string
  name: string
  // the numeric chain id
  chainId: number
  // the blockchain id on Dimension/assets
  assetId: string
  coingeckoId: string
}

export interface Token {
  chain: Chain
  address: string
  name: string
  symbol: string
}

export interface FungibleToken extends Token {
  decimals: number
}

export interface NonFungibleToken extends Token {
  uri: string
}
