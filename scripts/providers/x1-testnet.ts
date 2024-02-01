import { ChainId, FungibleToken, Provider, ProviderType } from '../type'

export class X1Testnet implements Provider {
  getProviderType(): ProviderType {
    return ProviderType.X1Testnet
  }
  async generateFungibleTokens(chainId: ChainId, exclude: FungibleToken[]): Promise<FungibleToken[]> {
    const tokens: FungibleToken[] = [
      {
        chainId: 195,
        address: '0x04292AF1Cf8687235a83766D55B307880Fc5E76D',
        name: 'USDC',
        symbol: 'USDC',
        decimals: 6,
      },
      {
        chainId: 195,
        address: '0x04292AF1Cf8687235a83766D55B307880Fc5E76D',
        name: 'USDT',
        symbol: 'USDT',
        decimals: 6,
      },
      {
        chainId: 195,
        address: '0x1b981E783D8d139e74ebBD7BE5D99d8a0A7eEb0A',
        name: 'DAI',
        symbol: 'DAI',
        decimals: 18,
      },
      {
        chainId: 195,
        address: '0x567a3238b3b380f96a90DfF5da8429E089062329',
        name: 'BTC',
        symbol: 'BTC',
        decimals: 8,
      },
      {
        chainId: 195,
        address: '0xBec7859BC3d0603BeC454F7194173E36BF2Aa5C8',
        name: '0xBec7859BC3d0603BeC454F7194173E36BF2Aa5C8',
        symbol: 'WETH',
        decimals: 18,
      },
    ]
    return tokens
  }
  isSupportChain(chainId: ChainId): boolean {
    return chainId === ChainId.X1Testnet
  }
}
