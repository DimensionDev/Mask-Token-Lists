import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { rest } from 'msw'
import { baseURL, CoinGecko } from './coingecko'
import { ChainId } from '../type'

// @ts-ignore
import * as existTokenListMockData from '../fixture/tokenList.json'
// @ts-ignore
import * as platformsMockData from '../fixture/coingecko-asset-platforms.json'
// @ts-ignore
import * as tokensMockData from '../fixture/coingecko-coins-markets.json'
// @ts-ignore
import * as coinDetailMockData from '../fixture/coingecko-coin-detail.json'
import { generateLogoURL } from '../utils/asset'

export const restHandlers = [
  rest.get(`${baseURL}/coins/markets`, (req, res, ctx) => {
    // @ts-ignore
    if (req.url.searchParams.get('page') === '0') {
      // @ts-ignore
      return res(ctx.status(200), ctx.json(tokensMockData.default))
    } else {
      return res(ctx.status(200), ctx.json([]))
    }
  }),
  rest.get(`${baseURL}/asset_platforms`, (req, res, ctx) => {
    // @ts-ignore
    return res(ctx.status(200), ctx.json(platformsMockData.default))
  }),
  rest.get(`${baseURL}/coins/usd-coin`, (req, res, ctx) => {
    // @ts-ignore
    return res(ctx.status(200), ctx.json(coinDetailMockData.default))
  }),
]

const server = setupServer(...restHandlers)

describe('CoinGecko Tests', () => {
  let instance: CoinGecko = null!

  beforeAll(() => {
    instance = new CoinGecko()
    server.listen({ onUnhandledRequest: 'error' })
  })
  afterEach(() => server.resetHandlers())

  it('should test is support current chain', function () {
    expect(instance.isSupportChain(ChainId.Mainnet)).toBe(true)
    // expect(instance.isSupportChain(ChainId.Rinkeby)).toBe(false)
  })

  it('should give origin list when not change on exist token list', async function () {
    const result = await instance.generateFungibleTokens(ChainId.Mainnet, existTokenListMockData.tokens)

    expect(result.length).toEqual(4)
    expect(result[0].address).toEqual(existTokenListMockData.tokens[0].address)
    expect(result[1].address).toEqual(existTokenListMockData.tokens[1].address)
    expect(result[2].address).toEqual(existTokenListMockData.tokens[2].address)
    expect(result[3].address).toEqual(existTokenListMockData.tokens[3].address)
  })

  it('should give list with added', async function () {
    const result = await instance.generateFungibleTokens(ChainId.Mainnet, [
      existTokenListMockData.tokens[0],
      existTokenListMockData.tokens[1],
      existTokenListMockData.tokens[3],
    ])

    expect(result.length).toEqual(4)
    expect(result[0]).toEqual({
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chainId: 1,
      decimals: 6,
      logoURI: generateLogoURL(ChainId.Mainnet, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
      name: 'USD Coin',
      symbol: 'usdc',
    })
    expect(result[1].address).toEqual(existTokenListMockData.tokens[0].address)
    expect(result[2].address).toEqual(existTokenListMockData.tokens[1].address)
    expect(result[3].address).toEqual(existTokenListMockData.tokens[3].address)
  })

  it('should exclude token with remove', async function () {
    const result = await instance.generateFungibleTokens(ChainId.Mainnet, [
      ...existTokenListMockData.tokens,
      {
        address: '0xc21223249ca28397b4b6541dffaecc539bff0c59',
        chainId: 1,
        decimals: 18,
        logoURI: generateLogoURL(ChainId.Mainnet, '0xc21223249ca28397b4b6541dffaecc539bff0c59'),
        name: 'TestToken',
        symbol: 'test',
      },
    ])

    expect(result.length).toEqual(4)
    expect(result[0].address).toEqual(existTokenListMockData.tokens[0].address)
    expect(result[1].address).toEqual(existTokenListMockData.tokens[1].address)
    expect(result[2].address).toEqual(existTokenListMockData.tokens[2].address)
    expect(result[3].address).toEqual(existTokenListMockData.tokens[3].address)
  })

  afterAll(() => server.close())
})
