const Mainnet = require("../src/fungible-tokens/mainnet.json");
const Ropsten = require("../src/fungible-tokens/ropsten.json");
const Rinkeby = require("../src/fungible-tokens/rinkeby.json");
const Optimistic = require("../src/fungible-tokens/optimistic.json");
const Fuse = require("../src/fungible-tokens/fuse.json");
const Bsc = require("../src/fungible-tokens/bsc.json");
const Heco = require("../src/fungible-tokens/heco.json");
const Chapel = require("../src/fungible-tokens/chapel.json");
const xDai = require("../src/fungible-tokens/xdai.json");
const Fantom = require("../src/fungible-tokens/fantom.json");
const Celo = require("../src/fungible-tokens/celo.json");
const Matic = require("../src/fungible-tokens/matic.json");
const Arbiturm = require("../src/fungible-tokens/arbiturm.json");
const Mumbai = require("../src/fungible-tokens/mumbai.json");
const Aurora = require("../src/fungible-tokens/aurora.json");
const Avalanche = require("../src/fungible-tokens/avalanche.json");
const Boba = require("../src/fungible-tokens/boba.json");
const Astar = require("../src/fungible-tokens/astar.json");

const GO_PLUS_LABS_ROOT_URL = "https://api.gopluslabs.io";
const GO_PLUS_TOKEN_SECURITY_URL = "api/v1/token_security";

const fetch = require("node-fetch");

const chainId = Number.parseInt(process.argv.slice(2)[0], 10);

// referer: https://github.com/GoPlusSecurityLabs/OpenAPI/blob/main/SecurityAPI.md
const supportedChainIds = [1, 56, 42161, 137, 128, 43114];

// max rates to trigger WARNING
const safeRatesRequireCheck = 20;

// max rates to trigger DANGER
const maxDangerRates = 40;

// modify here to change the rules referer: https://m8j6huhbzo.feishu.cn/docs/doccn5Sh4ZXxpODCVZ2ddgc6HQc
const rules = [
  {
    key: "is_open_source",
    value: 0,
  },
  {
    key: "is_proxy",
    value: 1,
  },
  {
    key: "is_mintable",
    value: 1,
  },
  {
    key: "is_verifiable_team",
    value: 0,
  },
  {
    key: "is_airdrop_scam",
    value: 1,
  },
];

const chainIdToTokensMapping = {
  1: Mainnet,
  3: Ropsten,
  4: Rinkeby,
  10: Optimistic,
  56: Bsc,
  97: Chapel,
  100: xDai,
  122: Fuse,
  128: Heco,
  250: Fantom,
  288: Boba,
  137: Matic,
  42161: Arbiturm,
  42220: Celo,
  43114: Avalanche,
  80001: Mumbai,
  1313161554: Aurora,
  592: Astar,
};

async function riskCheck() {
  if (!supportedChainIds.includes(chainId)) return;

  const addresses = chainIdToTokensMapping[chainId]
    .map((item) => item.address)
    .join(",");
  const url = `${GO_PLUS_LABS_ROOT_URL}/${GO_PLUS_TOKEN_SECURITY_URL}/${chainId}?contract_addresses=${addresses}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data?.result) {
      const temp = data.result;
      for (const key in temp) {
        const item = temp[key];
        caculateRiskRates(item, key);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function caculateRiskRates(item, key) {
  const res = rules.reduce((rates, cur) => {
    if (item[cur.key] == cur.value) {
      rates += 20;
    }
    return rates;
  }, 0);
  if (Number.parseInt(res, 10) >= maxDangerRates) {
    throw new Error(
      `\x1B[31m DANGER token address: ${key} you should check it in dist chainId: ${chainId}, and stop build`
    );
  }
  if (Number.parseInt(res, 10) > safeRatesRequireCheck) {
    console.error(
      "\x1B[33m WARNING! Risk token address:",
      key,
      "please check it in dist chainId:",
      chainId
    );
  }
}

riskCheck();
