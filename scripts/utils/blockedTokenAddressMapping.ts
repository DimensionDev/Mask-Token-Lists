import { ChainId } from '../type'
export const blockedTokenAddressMapping: Partial<Record<ChainId, string[]>> = {
  [ChainId.Mainnet]: [],
  [ChainId.BNB]: [],
  [ChainId.Polygon]: ['0x0000000000000000000000000000000000001010', '0xeb99748e91afca94a6289db3b02e7ef4a8f0a22d'],
  [ChainId.Arbitrum]: [],
  [ChainId.Avalanche]: [],
  [ChainId.Fantom]: [],
  [ChainId.xDai]: [],
  [ChainId.Aurora]: [],
  [ChainId.Optimistic]: [],
  [ChainId.Solana]: [],
}
