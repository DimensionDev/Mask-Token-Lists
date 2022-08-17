import { EthereumAddress } from "wallet.ts";
import { ChainId, FungibleToken } from "./types";
import ContractMetadata from "./fungible-tokens/contract-metadata.json";
import Mainnet from "./fungible-tokens/mainnet.json";
import Ropsten from "./fungible-tokens/ropsten.json";
import Rinkeby from "./fungible-tokens/rinkeby.json";
import Optimistic from "./fungible-tokens/optimistic.json";
import Fuse from "./fungible-tokens/fuse.json";
import BNB from "./fungible-tokens/bnb.json";
import Chapel from "./fungible-tokens/chapel.json";
import xDai from "./fungible-tokens/xdai.json";
import Sokol from "./fungible-tokens/sokol.json";
import Fantom from "./fungible-tokens/fantom.json";
import Celo from "./fungible-tokens/celo.json";
import Polygon from "./fungible-tokens/polygon.json";
import Arbitrum from "./fungible-tokens/arbitrum.json";
import Mumbai from "./fungible-tokens/mumbai.json";
import Aurora from "./fungible-tokens/aurora.json";
import Avalanche from "./fungible-tokens/avalanche.json";
import Boba from "./fungible-tokens/boba.json";
import Heco from "./fungible-tokens/heco.json";
import Moonbeam from "./fungible-tokens/moonbeam.json";
import Pancake from "./fungible-tokens/pancake.json";
import QucikSwapTokens from "./fungible-tokens/quickswap.json";
import Conflux from "./fungible-tokens/conflux.json";
import Metis from "./fungible-tokens/metis.json";
import Stardust from "./fungible-tokens/stardust.json";
import Cronos from "./fungible-tokens/cronos.json";
import Harmony from "./fungible-tokens/harmony.json";
import HarmonyTestnet from "./fungible-tokens/harmony-testnet.json";
import Kardiachain from "./fungible-tokens/kardiachain.json";
import Palm from "./fungible-tokens/palm.json";
import Moonriver from "./fungible-tokens/moonriver.json";
import Astar from "./fungible-tokens/astar.json";

import { fetchDebankLogoURI, generateTokenList } from "./helpers";

const MetaMask = (
  Object.keys(ContractMetadata) as (keyof typeof ContractMetadata)[]
)
  .filter((key) => {
    const record = ContractMetadata[key];
    return (
      typeof record.symbol === "string" &&
      typeof record.decimals === "number" &&
      typeof record.name === "string" &&
      new RegExp("^[ \\w.'+\\-%/À-ÖØ-öø-ÿ]+$").test(record.name) &&
      EthereumAddress.isValid(key)
    );
  })
  .map((key) => ({
    chainId: 1,
    address: key,
    symbol: ContractMetadata[key].symbol,
    decimals: ContractMetadata[key].decimals,
    name: ContractMetadata[key].name,
    logo: ContractMetadata[key].logo,
  }));

const QuickSwap = QucikSwapTokens.tokens.map(
  ({ name, address, symbol, decimals, logoURI }) => ({
    chainId: ChainId.Polygon,
    name,
    address,
    symbol,
    decimals,
    logoURI,
  })
);

function getFungibleTokenLists(): Record<ChainId, FungibleToken[][]> {
  return {
    [ChainId.Mainnet]: [Mainnet, MetaMask],
    [ChainId.Ropsten]: [Ropsten],
    [ChainId.Rinkeby]: [Rinkeby],
    [ChainId.Optimistic]: [Optimistic],
    [ChainId.Kardiachain]: [Kardiachain],
    [ChainId.Cronos]: [Cronos],
    [ChainId.BNB]: [BNB, Pancake],
    [ChainId.Sokol]: [Sokol],
    [ChainId.Chapel]: [Chapel],
    [ChainId.xDai]: [xDai],
    [ChainId.Fuse]: [Fuse],
    [ChainId.Heco]: [Heco],
    [ChainId.Fantom]: [Fantom],
    [ChainId.Boba]: [Boba],
    [ChainId.Polygon]: [Polygon, QuickSwap],
    [ChainId.Mumbai]: [Mumbai],
    [ChainId.Stardust]: [Stardust],
    [ChainId.Astar]: [Astar],
    [ChainId.Conflux]: [Conflux],
    [ChainId.Metis]: [Metis],
    [ChainId.Moonbeam]: [Moonbeam],
    [ChainId.Moonriver]: [Moonriver],
    [ChainId.Arbitrum]: [Arbitrum],
    [ChainId.Celo]: [Celo],
    [ChainId.Avalanche]: [Avalanche],
    [ChainId.Aurora]: [Aurora],
    [ChainId.Harmony]: [Harmony],
    [ChainId.Harmony_Testnet]: [HarmonyTestnet],
    [ChainId.Palm]: [Palm],
  };
}

const getMetaMaskLogoURL = (url: string) =>
  `https://raw.githubusercontent.com/MetaMask/contract-metadata/master/images/${url}`;

async function generateFungibleTokens(chainId: ChainId) {
  const tokenLists = getFungibleTokenLists();
  const baseTokens = tokenLists[chainId].flat();

  const debankTokens = await fetchDebankLogoURI(
    chainId,
    baseTokens.map((x) => x.address)
  );

  return baseTokens.map((token) => {
    const { logo, ...rest } = token as FungibleToken & { logo?: string };
    const tokenWithLogoURI = debankTokens.find(
      (x) => x.address.toLowerCase() === token.address.toLowerCase()
    );
    const logoURI =
      tokenWithLogoURI?.logoURI ||
      (logo && getMetaMaskLogoURL(logo)) ||
      token.logoURI;

    return logoURI ? { ...rest, logoURI } : { ...rest };
  });
}

export async function generate(chainId: ChainId) {
  const tokens = await generateFungibleTokens(chainId);
  const tokenList = generateTokenList(
    tokens
      .map((x) => ({
        ...x,
        address: EthereumAddress.checksumAddress(x.address),
      }))
      .sort((a, z) => {
        if (a.name > z.name) return 1;
        if (a.name < z.name) return -1;
        return 0;
      }),
    {
      name: "Mask Network",
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
    }
  );

  return JSON.stringify(tokenList);
}
