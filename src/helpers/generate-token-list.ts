import { EthereumAddress } from 'wallet.ts'
import Package from '../../package.json'
import { FungibleToken, NonFungibleToken } from '../types'

/**
 * generateTokenList.
 *
 * @param {Array<object>} specList
 * @param {Object} extraInfo
 */
export function generateTokenList(
  tokens: FungibleToken[] | NonFungibleToken[],
  extraInfo: Record<string, string | string[]>,
) {
  return {
    name: 'Mask',
    logoURI:
      'https://raw.githubusercontent.com/DimensionDev/Maskbook-Website/master/img/MB--CircleCanvas--WhiteOverBlue.svg',
    keywords: [
      'browser extension',
      'web3',
      'peer to peer',
      'encryption',
      'cryptography',
      'gundb',
      'privacy protection',
      'ownyourdata',
      'social network',
      'blockchain',
      'crypto',
      'dweb',
    ],
    ...extraInfo,
    timestamp: new Date().toISOString(),
    version: {
      major: Number.parseInt(Package.version.split('.')[0]),
      minor: Number.parseInt(Package.version.split('.')[1]),
      patch: Number.parseInt(Package.version.split('.')[2]),
    },
    tokens,
  }
}
