import { ChainId, FungibleToken, Provider, ProviderType } from '../type'
import urlcat from 'urlcat'
import axios from 'axios'
import { delay } from '../utils'
import { toChecksumAddress } from 'web3-utils'

const baseURL = 'https://astar.webapi.subscan.io'

type TokenResult = {
  code: number
  message: string
  generated_at: number
  data: {
    count: number
    list: Array<TokenInfo>
  }
}

interface TokenInfo {
  contract: string
  name: string
  symbol: string
  decimals: number
  totalSupply: string
  holders: number
  transfer_count: number
  price: string
  category: string
}

export class SubScan implements Provider {
  // The subScan not provider the list order by market cap
  async getTopTokens() {
    let page: number | undefined = 0
    let result: TokenInfo[] = []
    while (page !== undefined) {
      const url = urlcat(baseURL, '/api/scan/evm/tokens')
      const list = await axios.post<TokenResult>(
        url,
        {
          page,
          row: 100,
        },
        {
          withCredentials: true,
          headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json; charset=utf-8',
            'access-control-allow-credentials': true,
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
          },
        },
      )
      if (list.data.code === 0 && list.data.data.list.length) {
        result = [...result, ...list.data.data.list]
        page++
      } else {
        break
      }

      if (result.length >= 1000) {
        page = undefined
        break
      }
    }

    await delay(500)
    return result
  }

  async generateFungibleTokens(chainId: ChainId, exclude: FungibleToken[]): Promise<FungibleToken[]> {
    const allTokens = await this.getTopTokens()
    const topList = allTokens
      .filter((x) => x.contract && x.symbol)
      .map(
        (x) =>
          ({
            // The subScan not provide the logo url
            chainId,
            address: toChecksumAddress(x.contract),
            name: x.name,
            symbol: x.symbol,
            decimals: x.decimals,
          } as FungibleToken),
      )

    return [...topList, ...exclude]
  }

  getProviderType(): ProviderType {
    return ProviderType.SubScan
  }

  isSupportChain(chainId: ChainId): boolean {
    return chainId === ChainId.Astar
  }
}
