import { ChainId, FungibleToken } from '../type'
import { fetchAurora } from './explorers/aurora'
import { fetchOptimistic } from './explorers/optimistic'
import { fetchGnosis } from './explorers/gnosis'
import { fetchFantom } from './explorers/fantom'
import { fetchAvalanche } from './explorers/avalanche'
import { fetchArbitrum } from './explorers/arbitrum'
import { fetchPolygon } from './explorers/polygon'

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
  [ChainId.Polygon]: [...Array(10)].map((x, i) => `https://polygonscan.com/tokens?p=${i}&ps=100`),
  [ChainId.Arbitrum]: [...Array(4)].map((x, i) => `https://arbiscan.io/tokens?p=${i}&ps=100`),
  [ChainId.Avalanche]: [...Array(4)].map((x, i) => `https://snowtrace.io/tokens?p=${i}&ps=100`),
  [ChainId.Fantom]: [...Array(5)].map((x, i) => `https://ftmscan.com/tokens?p=${i}&ps=100`),
  [ChainId.xDai]: ['https://gnosisscan.io/tokens'],
  [ChainId.Aurora]: ['https://explorer.aurora.dev/tokens'],
  [ChainId.Optimistic]: ['https://optimistic.etherscan.io/tokens'],
}

export const explorerFetchMapping: Partial<Record<ChainId, (url: string) => Promise<FungibleToken[]>>> = {
  [ChainId.Mainnet]: async (url: string) => [],
  [ChainId.BNB]: async (url: string) => [],
  [ChainId.Polygon]: fetchPolygon,
  [ChainId.Arbitrum]: fetchArbitrum,
  [ChainId.Avalanche]: fetchAvalanche,
  [ChainId.Fantom]: fetchFantom,
  [ChainId.xDai]: fetchGnosis,
  [ChainId.Aurora]: fetchAurora,
  [ChainId.Optimistic]: fetchOptimistic,
}
