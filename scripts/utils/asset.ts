import urlcat from 'urlcat'
import { ChainId } from '../type'
import { convertEnumToArray } from './base'
import { toChecksumAddress } from 'web3-utils'

const ASSET_CDN_BASE = 'https://imagedelivery.net/PCnTHRkdRhGodr0AWBAvMA/Assets/blockchains/'

export function generateLogoURL(chainId: ChainId, address: string) {
  const chains = convertEnumToArray(ChainId)
  const chainDir = chainId === ChainId.Mainnet ? 'ethereum' : chains.find((x) => x.value === chainId)?.key

  if (!chainDir) return

  return urlcat(ASSET_CDN_BASE, '/:chain/assets/:address/logo.png/quality=85', {
    chain: chainDir.toLowerCase(),
    address: toChecksumAddress(address),
  })
}
