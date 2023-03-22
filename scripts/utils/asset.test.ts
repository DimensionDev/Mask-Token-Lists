import { assert, describe, expect, it } from 'vitest'
import { generateLogoURL } from './asset'
import { ChainId } from '../type'

describe('Asset Test', () => {
  it.each([
    [
      ChainId.Mainnet,
      'https://imagedelivery.net/PCnTHRkdRhGodr0AWBAvMA/Assets/blockchains/ethereum/assets/0x790116d0685eB197B886DAcAD9C247f785987A4a/logo.png/quality=85',
    ],
    // [
    //     ChainId.BNB,
    //     'https://imagedelivery.net/PCnTHRkdRhGodr0AWBAvMA/Assets/blockchains/bnb/assets/0x790116d0685eB197B886DAcAD9C247f785987A4a/logo.png/quality=85',
    // ],
    // [
    //     ChainId.Aurora,
    //     'https://imagedelivery.net/PCnTHRkdRhGodr0AWBAvMA/Assets/blockchains/aurora/assets/0x790116d0685eB197B886DAcAD9C247f785987A4a/logo.png/quality=85',
    // ],
  ])('Generate asset %i logo url', (chain: ChainId, expected: string) => {
    expect(generateLogoURL(chain, '0x790116d0685eB197B886DAcAD9C247f785987A4a')).toBe(expected)
  })
})
