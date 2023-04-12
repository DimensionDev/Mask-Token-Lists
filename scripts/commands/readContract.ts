import { EthereumAddress } from 'wallet.ts'
import { BaseContract, ERC20 } from '../contract/type'
import ERC20ABI from '../contract/ERC20.json'
import { rpcMapping } from '../utils/base'
import { ChainId } from '../type'
import type { AbiItem } from 'web3-utils'
import Web3 from 'web3'

export async function readContract(chainId: ChainId) {
  const rpcUrl = rpcMapping[chainId]
  if (!rpcUrl) process.exit(0)

  const web3 = new Web3(rpcUrl)
  const contract = createContract<ERC20>(web3, '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', ERC20ABI as AbiItem[])
  console.log({ web3, contract })
  try {
    const symbol = await contract?.methods.symbol().call()
    console.log({ symbol })
  } catch (e) {
    console.log({ e })
  }
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
