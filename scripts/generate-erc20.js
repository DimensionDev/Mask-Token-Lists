const { schema } = require("@uniswap/token-lists");
const quickswapTokenlist = require("quickswap-default-token-list");
const Ajv = require("ajv");
const metadata = require("eth-contract-metadata");
const { EthereumAddress } = require("wallet.ts");
const Mainnet = require("../src/erc20/mainnet.json");
const Ropsten = require("../src/erc20/ropsten.json");
const Rinkeby = require("../src/erc20/rinkeby.json");
const Bsc = require("../src/erc20/bsc.json");
const Chapel = require("../src/erc20/chapel.json");
const Matic = require("../src/erc20/matic.json");
const Mumbai = require("../src/erc20/mumbai.json");
const PancakeTop100 = require("../src/erc20/pancake-top100.json");
const { addChainId, generateTokenList } = require("./shared");

const quickswapTokens = quickswapTokenlist.tokens.map(
  ({ name, address, symbol, decimals, logoURI }) => ({
    name,
    address,
    symbol,
    decimals,
    logoURI
  })
);

const MaskTokenList = generateTokenList(
  [
    ...addChainId(Mainnet, 1),
    ...addChainId(Ropsten, 3),
    ...addChainId(Rinkeby, 4),
    ...addChainId(Bsc, 56),
    ...addChainId(PancakeTop100, 56),
    ...addChainId(Chapel, 97),
    ...addChainId(Matic, 137),
    ...addChainId(quickswapTokens, 137),
    ...addChainId(Mumbai, 80001),
    ...Object.keys(metadata)
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
      })),
  ]
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
