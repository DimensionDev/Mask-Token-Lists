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
      "browser extension",
      "web3",
      "peer to peer",
      "encryption",
      "cryptography",
      "gundb",
      "privacy protection",
      "ownyourdata",
      "social network",
      "blockchain",
      "crypto",
      "dweb",
    ],
    timestamp: new Date().toISOString(),
  });

  return JSON.stringify(tokenList);
}
