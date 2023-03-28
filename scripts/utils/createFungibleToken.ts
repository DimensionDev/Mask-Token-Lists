import { ChainId, FungibleToken } from '../type'
import { generateLogoURL } from './asset'
export function createFungibleToken(
  chainId: ChainId,
  address: string,
  fullName: string,
  decimals: number,
  originLogoURI: string,
): FungibleToken {
  return {
    chainId,
    address,
    name: fullName.replace(/ \(.*\)/g, ''),
    symbol:
      fullName
        .match(/\(.*\)$/g)?.[0]
        ?.replace('(', '')
        .replace(')', '') ?? '',
    decimals,
    logoURI: generateLogoURL(ChainId.Aurora, address),
    originLogoURI,
  }
}
