import { ChainId } from '../type'
export const blockedTokenAddressMapping: Partial<Record<ChainId, string[]>> = {
  [ChainId.Mainnet]: [],
  [ChainId.BNB]: [],
  [ChainId.Polygon]: ['0x0000000000000000000000000000000000001010'],
  [ChainId.Arbitrum]: [],
  [ChainId.Avalanche]: [],
  [ChainId.Fantom]: [],
  [ChainId.xDai]: [],
  [ChainId.Aurora]: [],
  [ChainId.Optimistic]: [],
  [ChainId.Solana]: [],
}
