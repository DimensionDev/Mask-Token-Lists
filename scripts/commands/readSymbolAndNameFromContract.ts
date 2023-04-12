import { EthereumAddress } from 'wallet.ts'
import { BaseContract, ERC20 } from '../contract/type'
import ERC20ABI from '../contract/ERC20.json'
import { rpcMapping } from '../utils/base'
import { ChainId, FungibleToken } from '../type'
import type { AbiItem } from 'web3-utils'
import Web3 from 'web3'
import { getLatestReleasedTokenList } from './generate'

export async function readSymbolAndNameFromContract(chainId: ChainId) {
  const rpcUrl = rpcMapping[chainId] ?? ''
  const latestReleaseTokenList: FungibleToken[] = await getLatestReleasedTokenList(chainId)
  const web3 = new Web3(rpcUrl)

  const allSettled = await Promise.allSettled(
    latestReleaseTokenList.map(async (token) => {
      const contract = createContract<ERC20>(web3, token.address, ERC20ABI as AbiItem[])
      try {
        const symbol = await contract?.methods.symbol().call()
        const name = await contract?.methods.name().call()
        console.log({ symbol, name })
        return { ...token, name, symbol }
      } catch (e) {
        console.log({ e })
        return token
      }
    }),
  )

  const results = allSettled
    .map((x) => (x.status === 'fulfilled' && x.value ? x.value : undefined))
    .filter((x) => Boolean(x)) as FungibleToken[]

  console.log({ results })

  process.exit(0)
}

function createContract<T extends BaseContract>(web3: Web3 | null, address: string, ABI: AbiItem[]) {
  if (!address || !isValidAddress(address) || !web3) return null
  const contract = new web3.eth.Contract(ABI, address) as unknown as T
  return contract
}

function isValidAddress(address?: string): address is string {
  if (!address) return false
  return EthereumAddress.isValid(address)
}
