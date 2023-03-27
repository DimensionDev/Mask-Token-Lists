import { ChainId, FungibleToken } from '../type'
import { fetchAurora, fetchAuroraForTokenDecimal } from './explorers/aurora'
import { fetchOptimistic } from './explorers/optimistic'
import { fetchGnosis } from './explorers/gnosis'
import { fetchFantom } from './explorers/fantom'
import { fetchAvalanche } from './explorers/avalanche'
import { fetchArbitrum } from './explorers/arbitrum'
import { fetchPolygon } from './explorers/polygon'
import { fetchBSC } from './explorers/bsc'
import { fetchETH } from './explorers/eth'

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
  [ChainId.Mainnet]: [...Array(10)].map((x, i) => `https://etherscan.io/tokens?p=${i}&ps=100`),
  [ChainId.BNB]: [...Array(10)].map((x, i) => `https://bscscan.com/tokens?p=${i}&ps=100`),
  [ChainId.Polygon]: [...Array(8)].map((x, i) => `https://polygonscan.com/tokens?p=${i}&ps=100`),
  [ChainId.Arbitrum]: [...Array(4)].map((x, i) => `https://arbiscan.io/tokens?p=${i}&ps=100`),
  [ChainId.Avalanche]: [...Array(4)].map((x, i) => `https://snowtrace.io/tokens?p=${i}&ps=100`),
  [ChainId.Fantom]: [...Array(5)].map((x, i) => `https://ftmscan.com/tokens?p=${i}&ps=100`),
  [ChainId.xDai]: ['https://gnosisscan.io/tokens'],
  [ChainId.Aurora]: ['https://explorer.aurora.dev/tokens'],
  [ChainId.Optimistic]: ['https://optimistic.etherscan.io/tokens'],
}

export const explorerDecimalPageMapping: Partial<Record<ChainId, (address: string) => string>> = {
  [ChainId.Mainnet]: () => '',
  [ChainId.BNB]: () => '',
  [ChainId.Polygon]: () => '',
  [ChainId.Arbitrum]: () => '',
  [ChainId.Avalanche]: () => '',
  [ChainId.Fantom]: () => '',
  [ChainId.xDai]: () => '',
  [ChainId.Aurora]: (address) => `https://explorer.aurora.dev/token/${address}/token-transfers`,
  [ChainId.Optimistic]: () => '',
}

export const explorerFetchMapping: Partial<Record<ChainId, (url: string) => Promise<FungibleToken[]>>> = {
  [ChainId.Mainnet]: fetchETH,
  [ChainId.BNB]: fetchBSC,
  [ChainId.Polygon]: fetchPolygon,
  [ChainId.Arbitrum]: fetchArbitrum,
  [ChainId.Avalanche]: fetchAvalanche,
  [ChainId.Fantom]: fetchFantom,
  [ChainId.xDai]: fetchGnosis,
  [ChainId.Aurora]: fetchAurora,
  [ChainId.Optimistic]: fetchOptimistic,
}

export const explorerFetchTokenDecimalMapping: Partial<Record<ChainId, (url: string) => Promise<number>>> = {
  [ChainId.Mainnet]: async () => 0,
  [ChainId.BNB]: async () => 0,
  [ChainId.Polygon]: async () => 0,
  [ChainId.Arbitrum]: async () => 0,
  [ChainId.Avalanche]: async () => 0,
  [ChainId.Fantom]: async () => 0,
  [ChainId.xDai]: async () => 0,
  [ChainId.Aurora]: fetchAuroraForTokenDecimal,
  [ChainId.Optimistic]: async () => 0,
}
