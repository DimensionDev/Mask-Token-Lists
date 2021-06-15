const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const url = "https://tokens.pancakeswap.finance/pancakeswap-top-100.json";
const fileDest = path.resolve(__dirname, "../src/erc20/pancake-top100.json");

async function fetchTop100() {
  const res = await fetch(url);
  const data = await res.json();

  const tokens = data.tokens.map(({ name, symbol, address, decimals, logoURI }) => ({
    name,
    symbol,
    address,
    decimals,
    logoURI
  }));

  console.log("tokens:");
  console.log(tokens);

  fs.writeFileSync(fileDest, JSON.stringify(tokens, null, 2));
}

fetchTop100();
