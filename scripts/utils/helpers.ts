import { ChainId, FungibleToken } from '../type'
import urlcat from 'urlcat'
import axios from 'axios'

const TOKEN_LIST_BASE_URL = 'https://tokens.r2d2.to/'

export function isSameAddress(address?: string | undefined, otherAddress?: string | undefined): boolean {
  if (!address || !otherAddress) return false
  return address.toLowerCase() === otherAddress.toLowerCase()
}

export async function getLatestReleasedTokenList(chainId: ChainId) {
  const requestURL = urlcat(TOKEN_LIST_BASE_URL, 'latest/:chainId/tokens.json', { chainId })
  try {
    const listInfo = await axios.get<{ tokens: FungibleToken[] }>(requestURL)
    return listInfo.data.tokens
  } catch (e) {
    console.log(`fetch latest released token list failed(chainId: ${chainId})`)
    return []
  }
}
