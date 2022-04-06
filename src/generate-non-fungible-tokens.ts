import { ChainId, NonFungibleToken } from "./types";
import Mainnet from "./non-fungible-tokens/mainnet.json";
import { generateTokenList } from "./helpers";

function getNonFungileTokenLists(): Record<ChainId, NonFungibleToken[][]> {
  return {
    [ChainId.Mainnet]: [Mainnet],
    [ChainId.Ropsten]: [],
    [ChainId.Rinkeby]: [],
    [ChainId.Optimistic]: [],
    [ChainId.BNB]: [],
    [ChainId.Chapel]: [],
    [ChainId.xDai]: [],
    [ChainId.Fuse]: [],
    [ChainId.Heco]: [],
    [ChainId.Fantom]: [],
    [ChainId.Boba]: [],
    [ChainId.Polygon]: [],
    [ChainId.Mumbai]: [],
    [ChainId.Conflux]: [],
    [ChainId.Arbiturm]: [],
    [ChainId.Celo]: [],
    [ChainId.Avalanche]: [],
    [ChainId.Aurora]: [],
    [ChainId.Moonbeam]: [],
    [ChainId.Moonriver]: [],
    [ChainId.Palm]: [],
  };
}

function generateNonFungibleTokenLists(chainId: ChainId) {
  const tokenLists = getNonFungileTokenLists();
  const baseTokens = tokenLists[chainId].flat();

  return baseTokens;
}

export async function generate(chainId: ChainId) {
  const tokens = await generateNonFungibleTokenLists(chainId);
  const tokenList = generateTokenList(tokens, {
    name: "Mask",
    logoURI:
      "https://raw.githubusercontent.com/DimensionDev/Maskbook-Website/master/img/MB--CircleCanvas--WhiteOverBlue.svg",
    keywords: [
      "cryptography",
      "crypto",
      "encryption",
      "social-network",
      "peer-to-peer",
      "ethereum",
      "ipfs",
      "blockchain",
      "browser extension",
      "web3",
      "gundb",
      "nft",
      "privacy-protection",
      "dweb",
      "defi",
      "arweave",
    ],
    timestamp: new Date().toISOString(),
  });

  return JSON.stringify(tokenList);
}
