import fetch from 'node-fetch'
import { ChainId } from '../types'

const getRequestURL = (chainId: string, ids: string[]) =>
  `https://openapi.debank.com/v1/token/list_by_ids?chain_id=${chainId}&ids=${ids.join(',')}`

const DEBANK_REQUEST_LIMIT = 60

const CHAINID_MAPPING: Partial<Record<ChainId, string>> = {
  [ChainId.Mainnet]: 'eth',
  [ChainId.BNB]: 'bsc',
  [ChainId.Polygon]: 'matic',
}

export async function fetchDebankLogoURI(chainId: ChainId, tokenIds: string[]) {
  const key = CHAINID_MAPPING[chainId]

  if (!key) return []

  interface DebankTokenInfo {
    id: string
    logo_url: string
  }

  const allRequest: Promise<DebankTokenInfo>[] = []
  for (let i = 0, j = tokenIds.length; i < j; i += DEBANK_REQUEST_LIMIT) {
    const currentIds = tokenIds.slice(i, i + DEBANK_REQUEST_LIMIT)
    allRequest.push(fetch(getRequestURL(key, currentIds)).then((res) => res.json()))
  }
  const data = (await Promise.allSettled(allRequest))
    .filter((x): x is PromiseFulfilledResult<DebankTokenInfo> => x.status === 'fulfilled')
    .map((x) => x.value)
    .flat()

  return data.map((x) => ({
    address: x.id,
    logoURI: x.logo_url,
  }))
}
