import { EthereumAddress } from 'wallet.ts'
import { BaseContract, ERC20 } from '../contract/type'
import ERC20ABI from '../contract/ERC20.json'
import type { AbiItem } from 'web3-utils'
import Web3 from 'web3'

export async function readContract() {
  const web3 = new Web3('https://polygon-mainnet.infura.io/v3/d74bd8586b9e44449cef131d39ceeefb')
  const contract = createContract<ERC20>(web3, '0x750e4C4984a9e0f12978eA6742Bc1c5D248f40ed', ERC20ABI as AbiItem[])
  const symbol = await contract?.methods.symbol().call()
  console.log({ symbol })
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
