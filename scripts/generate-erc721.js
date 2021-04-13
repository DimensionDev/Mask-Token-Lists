const { schema } = require("@uniswap/token-lists");
const Ajv = require("ajv");
const NFTMainnet = require("../src/erc721/mainnet.json");
const { addChainId, generateTokenList } = require("./shared");

const NFTMaskTokenList = generateTokenList([...addChainId(NFTMainnet, 1)], {
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

const ajv = new Ajv();
const validate = ajv.compile(schema);
if (validate(NFTMaskTokenList)) {
  process.stdout.write(JSON.stringify(NFTMaskTokenList));
} else {
  console.error("errors on build erc721:");
  console.error(validate.errors);
  process.exit(1);
}
