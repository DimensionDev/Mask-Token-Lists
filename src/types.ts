export enum ChainId {
  Mainnet = 1,
  Ropsten = 3,
  Rinkeby = 4,
  Optimistic = 10,
  BNB = 56,
  Chapel = 97,
  xDai = 100,
  Fuse = 122,
  Heco = 128,
  Fantom = 250,
  Boba = 288,
  Polygon = 137,
  Mumbai = 80001,
  Conflux = 1030,
  Arbiturm = 42161,
  Celo = 42220,
  Avalanche = 43114,
  Aurora = 1313161554,
}

export interface FungibleToken {
  chainId: ChainId;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

export interface NonFungibleToken {
  chainId: ChainId;
  address: string;
  name: string;
  symbol?: string;
  logoURI?: string;
}