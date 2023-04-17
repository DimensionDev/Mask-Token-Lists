import { ChainId, FungibleToken } from '../type'
import { fetchAurora, fetchAuroraForTokenDecimal } from './explorers/aurora'
import { fetchOptimistic, fetchOptimisticForTokenDecimal } from './explorers/optimistic'
import { fetchGnosis, fetchGnosisForTokenDecimal } from './explorers/gnosis'
import { fetchFantom, fetchFantomForTokenDecimal } from './explorers/fantom'
import { fetchAvalanche, fetchAvalancheForTokenDecimal } from './explorers/avalanche'
import { fetchArbitrum, fetchArbitrumForTokenDecimal } from './explorers/arbitrum'
import { fetchPolygon, fetchPolygonForTokenDecimal } from './explorers/polygon'
import { fetchBSC, fetchBSCForTokenDecimal } from './explorers/bsc'
import { fetchETH, fetchETHForTokenDecimal } from './explorers/eth'
import { fetchSolanaForTokenDecimal } from './explorers/solana'
import { fetchConflux } from './explorers/conflux'
import { Browser } from 'puppeteer'

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
  [ChainId.Arbitrum]: [...Array(3)].map((x, i) => `https://arbiscan.io/tokens?p=${i}&ps=100`),
  [ChainId.Avalanche]: [...Array(4)].map((x, i) => `https://snowtrace.io/tokens?p=${i}&ps=100`),
  [ChainId.Fantom]: [...Array(5)].map((x, i) => `https://ftmscan.com/tokens?p=${i}&ps=100`),
  [ChainId.xDai]: ['https://gnosisscan.io/tokens?ps=100'],
  [ChainId.Aurora]: ['https://explorer.aurora.dev/tokens'],
  [ChainId.Optimistic]: ['https://optimistic.etherscan.io/tokens'],
  [ChainId.Conflux]: [...Array(3)].map(
    (x, i) => `https://evm.confluxscan.net/tokens?limit=100&orderBy=totalPrice&reverse=true&skip=${i * 100}`,
  ),
}

export const explorerDecimalPageMapping: Partial<Record<ChainId, (address: string) => string>> = {
  [ChainId.Mainnet]: (address) => `https://etherscan.io/token/${address}`,
  [ChainId.BNB]: (address) => `https://bscscan.com/token/${address}`,
  [ChainId.Polygon]: (address) => `https://polygonscan.com/token/${address}`,
  [ChainId.Arbitrum]: (address) => `https://arbiscan.io/token/${address}`,
  [ChainId.Avalanche]: (address) => `https://snowtrace.io/token/${address}`,
  [ChainId.Fantom]: (address) => `https://ftmscan.com/token/${address}`,
  [ChainId.xDai]: (address) => `https://gnosisscan.io/token/${address}`,
  [ChainId.Aurora]: (address) => `https://explorer.aurora.dev/token/${address}/token-transfers`,
  [ChainId.Optimistic]: (address) => `https://optimistic.etherscan.io/token/${address}`,
  [ChainId.Solana]: (address) => `https://solana.fm/address/${address}?cluster=mainnet-solanafmbeta`,
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
  [ChainId.Conflux]: fetchConflux,
}

export const explorerFetchTokenDecimalMapping: Partial<
  Record<ChainId, (url: string, browser: Browser) => Promise<number>>
> = {
  [ChainId.Mainnet]: fetchETHForTokenDecimal,
  [ChainId.BNB]: fetchBSCForTokenDecimal,
  [ChainId.Polygon]: fetchPolygonForTokenDecimal,
  [ChainId.Arbitrum]: fetchArbitrumForTokenDecimal,
  [ChainId.Avalanche]: fetchAvalancheForTokenDecimal,
  [ChainId.Fantom]: fetchFantomForTokenDecimal,
  [ChainId.xDai]: fetchGnosisForTokenDecimal,
  [ChainId.Aurora]: fetchAuroraForTokenDecimal,
  [ChainId.Optimistic]: fetchOptimisticForTokenDecimal,
  [ChainId.Solana]: fetchSolanaForTokenDecimal,
}

export const rpcMapping: Partial<Record<ChainId, string>> = {
  [ChainId.Mainnet]: 'https://mainnet.infura.io/v3/d74bd8586b9e44449cef131d39ceeefb',
  [ChainId.BNB]: 'https://bsc-dataseed.binance.org/',
  [ChainId.Polygon]: 'https://polygon-mainnet.infura.io/v3/d74bd8586b9e44449cef131d39ceeefb',
  [ChainId.Arbitrum]: 'https://arb1.arbitrum.io/rpc',
  [ChainId.Avalanche]: 'https://api.avax.network/ext/bc/C/rpc',
  [ChainId.Fantom]: 'https://rpc.ftm.tools',
  [ChainId.xDai]: 'https://rpc.gnosischain.com',
  [ChainId.Aurora]: 'https://mainnet.aurora.dev',
  [ChainId.Optimistic]: 'https://node.onekey.so/optimism',
  [ChainId.Conflux]: 'https://evm.confluxrpc.com',
}
