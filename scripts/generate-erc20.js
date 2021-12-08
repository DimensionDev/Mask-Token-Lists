const { schema } = require("@uniswap/token-lists");
const quickswapTokenlist = require("../src/erc20/quickswap-default-token-list.json");
const Ajv = require("ajv");
const metadata = require("../src/erc20/contract-metadata.json");
const { EthereumAddress } = require("wallet.ts");
const Mainnet = require("../src/erc20/mainnet.json");
const Ropsten = require("../src/erc20/ropsten.json");
const Rinkeby = require("../src/erc20/rinkeby.json");
const Bsc = require("../src/erc20/bsc.json");
const Chapel = require("../src/erc20/chapel.json");
const xDai = require("../src/erc20/xdai.json");
const Fantom = require("../src/erc20/fantom.json");
const Celo = require("../src/erc20/celo.json")
const Matic = require("../src/erc20/matic.json");
const Arbiturm = require("../src/erc20/arbiturm.json");
const Mumbai = require("../src/erc20/mumbai.json");
const PancakeTop100 = require("../src/erc20/pancake-top100.json");
const { fetchDebankLogoURI } = require("./fetch-debank-logo-uri");
const { addChainId, generateTokenList } = require("./shared");

const getMatamaskLogoURI = (url) =>
  `https://raw.githubusercontent.com/MetaMask/contract-metadata/master/images/${url}`;

const chainId = parseInt(process.argv.slice(2)[0]);

const metaMaskToken = Object.keys(metadata)
  .filter((key) => {
    const record = metadata[key];
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
    symbol: metadata[key].symbol,
    decimals: metadata[key].decimals,
    name: metadata[key].name,
    logo: metadata[key].logo,
  }));

const quickswapTokens = quickswapTokenlist.tokens.map(
  ({ name, address, symbol, decimals, logoURI }) => ({
    name,
    address,
    symbol,
    decimals,
    logoURI,
  })
);

const chainIdToTokensMapping = {
  1: [metaMaskToken, Mainnet],
  3: [Ropsten],
  4: [Rinkeby],
  56: [Bsc, PancakeTop100],
  97: [Chapel],
  100: [xDai],
  250: [Fantom],
  137: [Matic, quickswapTokens],
  42161: [Arbiturm],
  42220: [Celo],
  80001: [Mumbai],
};

const getUntreatedTokens = async () => {
  const baseTokens =
    chainId === 0
      ? Object.entries(chainIdToTokensMapping)
          .map(([key, value]) => {
            return value.map((x) => addChainId(x, parseInt(key)));
          })
          .flat()
          .flat()
      : chainIdToTokensMapping[chainId]
          .map((x) => addChainId(x, chainId))
          .flat();

  const debankTokens = await fetchDebankLogoURI(
    chainId,
    baseTokens.map((x) => x.address)
  );

  return baseTokens.map((token) => {
    const { logo, ...rest } = token;
    const tokenWithLogoURI = debankTokens.find(
      (x) => x.address.toLowerCase() === token.address.toLowerCase()
    );
    const logoURI =
      tokenWithLogoURI?.logoURI ||
      (logo && getMatamaskLogoURI(logo)) ||
      token.logoURI;

    return logoURI ? { ...rest, logoURI } : { ...rest };
  });
};

const start = async () => {
  const tokens = await getUntreatedTokens();
  const MaskTokenList = generateTokenList(
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
    }
  );

  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  if (validate(MaskTokenList)) {
    process.stdout.write(JSON.stringify(MaskTokenList));
  } else {
    console.error("errors on build erc20:");
    console.error(validate.errors);
    process.exit(1);
  }
};

start();
