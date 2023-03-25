import { ChainId, FungibleToken } from '../type'
import { fetchAurora } from './explorers/aurora'
import { fetchOptimistic } from './explorers/optimistic'
import { fetchGnosis } from './explorers/gnosis'

export function convertEnumToArray(e: any) {
  return Object.keys(e)
    .filter((v) => isNaN(Number(v)))
    .map((key) => {
      return {
        key,
        value: e[key as keyof typeof e],
      }
    })
}

export const explorerPagesMapping: Partial<Record<ChainId, string[]>> = {
  [ChainId.Mainnet]: [],
  [ChainId.BNB]: [],
  [ChainId.Polygon]: [],
  [ChainId.Arbitrum]: [],
  [ChainId.Avalanche]: [],
  [ChainId.Fantom]: [],
  [ChainId.xDai]: ['https://gnosisscan.io/tokens'],
  [ChainId.Aurora]: ['https://explorer.aurora.dev/tokens'],
  [ChainId.Optimistic]: ['https://optimistic.etherscan.io/tokens'],
}

export const explorerFetchMapping: Partial<Record<ChainId, (url: string) => Promise<FungibleToken[]>>> = {
  [ChainId.Mainnet]: async (url: string) => [],
  [ChainId.BNB]: async (url: string) => [],
  [ChainId.Polygon]: async (url: string) => [],
  [ChainId.Arbitrum]: async (url: string) => [],
  [ChainId.Avalanche]: async (url: string) => [],
  [ChainId.Fantom]: async (url: string) => [],
  [ChainId.xDai]: fetchGnosis,
  [ChainId.Aurora]: fetchAurora,
  [ChainId.Optimistic]: fetchOptimistic,
}
