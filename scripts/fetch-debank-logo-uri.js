const fetch = require("node-fetch");

// https://openapi.debank.com/docs
const getRequestURL = (chainId, ids) => `https://openapi.debank.com/v1/token/list_by_ids?chain_id=${chainId}&ids=${ids}`

const DEBANK_REQUEST_LIMIT = 60

const CHAINID_MAPPING = {
  1: 'eth',
  56: 'bsc',
  137: 'matic'
}

async function fetchDebankLogoURI(chainId, tokenIds) {
  if (!CHAINID_MAPPING[chainId]) return []

  const allRequest = []
  for (let i = 0, j = tokenIds.length; i < j; i += DEBANK_REQUEST_LIMIT) {
    const currentIds = tokenIds.slice(i, i + DEBANK_REQUEST_LIMIT);
    allRequest.push(fetch(getRequestURL(CHAINID_MAPPING[chainId], currentIds.join(','))).then(res => res.json()))
  }
  const data = (await Promise.allSettled(allRequest)).filter(x => x.status === 'fulfilled').map(x => x.value).flat()

  return data.map(x => (
    {
      address: x.id,
      logoURI: x.logo_url,
    }
  ))
}

exports.fetchDebankLogoURI = fetchDebankLogoURI;
