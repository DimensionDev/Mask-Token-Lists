import { writeFile } from "fs/promises";
import fetch from "node-fetch";
import { resolve } from "path";
import { FungibleToken } from "../types";

const url = "https://tokens.pancakeswap.finance/pancakeswap-top-100.json";
const fileDest = resolve(__dirname, "../src/fungible-tokens/pancake.json");

async function fetchTop100() {
  const res = await fetch(url);
  const data = (await res.json()) as {
    tokens: FungibleToken[];
  };

  const tokens = data.tokens.map(
    ({ name, symbol, address, decimals, logoURI }) => ({
      name,
      symbol,
      address,
      decimals,
      logoURI,
    })
  );

  await writeFile(fileDest, JSON.stringify(tokens, null, 2));
}

fetchTop100();
