const { schema } = require("@uniswap/token-lists");
const Ajv = require("ajv");
const metadata = require("eth-contract-metadata");
const { EthereumAddress } = require("wallet.ts");
const Mainnet = require("./erc20/mainnet.json");
const Rinkeby = require("./erc20/rinkeby.json");

function generateMaskbookTokenList() {
  const uniqueSet = new Set();
  return {
    name: "Maskbook",
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
    version: {
      major: 1,
      minor: 0,
      patch: 0,
    },
    tokens: [
      ...[...Mainnet.built_in_tokens, ...Mainnet.predefined_tokens].map(
        (x) => ({
          chainId: 1,
          ...x,
        })
      ),

      ...[...Rinkeby.built_in_tokens, ...Rinkeby.predefined_tokens].map(
        (x) => ({
          chainId: 4,
          ...x,
        })
      ),

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
          address: EthereumAddress.checksumAddress(key),
          symbol: metadata[key].symbol,
          decimals: metadata[key].decimals,
          name: metadata[key].name,
        })),
    ].filter((x) => {
      const key = x.address.toLowerCase();
      if (uniqueSet.has(key)) return false;
      uniqueSet.add(key);
      return true;
    }),
    logoURI:
      "https://raw.githubusercontent.com/DimensionDev/Maskbook-Website/master/img/MB--CircleCanvas--WhiteOverBlue.svg",
  };
}

const MaskbookTokenList = generateMaskbookTokenList();

const ajv = new Ajv();
const validate = ajv.compile(schema);
if (validate(MaskbookTokenList)) {
  process.stdout.write(JSON.stringify(MaskbookTokenList));
} else {
  console.error(validate.errors);
  process.exit(1);
}
