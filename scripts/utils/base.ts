import { ChainId, FungibleToken } from '../type'
import { fetchAurora } from './explorers/aurora'

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
  [ChainId.xDai]: [],
  [ChainId.Aurora]: ['https://explorer.aurora.dev/tokens'],
  // [ChainId.Optimistic]: 'https://optimistic.etherscan.io',
}

export const explorerBasURLMapping: Partial<Record<ChainId, string>> = {
  [ChainId.Mainnet]: 'https://etherscan.io',
  [ChainId.BNB]: 'https://bscscan.com',
  [ChainId.Polygon]: 'https://polygonscan.com',
  [ChainId.Arbitrum]: 'https://arbiscan.io',
  [ChainId.Avalanche]: 'https://snowtrace.io',
  [ChainId.Fantom]: 'https://ftmscan.com',
  [ChainId.xDai]: 'https://gnosisscan.io',
  [ChainId.Aurora]: 'https://explorer.aurora.dev',
  // [ChainId.Optimistic]: 'https://optimistic.etherscan.io',
}

export const explorerFetchMapping: Partial<Record<ChainId, (url: string) => Promise<FungibleToken[]>>> = {
  [ChainId.Mainnet]: async (url: string) => [],
  [ChainId.BNB]: async (url: string) => [],
  [ChainId.Polygon]: async (url: string) => [],
  [ChainId.Arbitrum]: async (url: string) => [],
  [ChainId.Avalanche]: async (url: string) => [],
  [ChainId.Fantom]: async (url: string) => [],
  [ChainId.xDai]: async (url: string) => [],
  [ChainId.Aurora]: fetchAurora,
  // [ChainId.Optimistic]: (url: string) => '',
}
