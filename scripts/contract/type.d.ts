import BN from 'bn.js'
import { Contract } from 'web3-eth-contract'
import { EventLog, PromiEvent, TransactionReceipt } from 'web3-core/types'
import { EventEmitter } from 'events'
import { EventLog } from 'web3-core'

interface EstimateGasOptions {
  from?: string
  gas?: number
  value?: number | string | BN
}

interface EventOptions {
  filter?: object
  fromBlock?: BlockType
  topics?: string[]
}

type Callback<T> = (error: Error, result: T) => void
interface ContractEventLog<T> extends EventLog {
  returnValues: T
}
interface ContractEventEmitter<T> extends EventEmitter {
  on(event: 'connected', listener: (subscriptionId: string) => void): this
  on(event: 'data' | 'changed', listener: (event: ContractEventLog<T>) => void): this
  on(event: 'error', listener: (error: Error) => void): this
}

interface NonPayableTx {
  nonce?: string | number | BN
  chainId?: string | number | BN
  from?: string
  to?: string
  data?: string
  gas?: string | number | BN
  gasPrice?: string | number | BN
}

interface PayableTx extends NonPayableTx {
  value?: string | number | BN
}

interface NonPayableTransactionObject<T> {
  arguments: any[]
  call(tx?: NonPayableTx, block?: BlockType): Promise<T>
  send(tx?: NonPayableTx): PromiEvent<TransactionReceipt>
  estimateGas(tx?: NonPayableTx): Promise<number>
  encodeABI(): string
}

interface PayableTransactionObject<T> {
  arguments: any[]
  call(tx?: PayableTx, block?: BlockType): Promise<T>
  send(tx?: PayableTx): PromiEvent<TransactionReceipt>
  estimateGas(tx?: PayableTx): Promise<number>
  encodeABI(): string
}

type BlockType = 'latest' | 'pending' | 'genesis' | 'earliest' | number | BN
type BaseContract = Omit<Contract, 'clone' | 'once'>

interface EventOptions {
  filter?: object
  fromBlock?: BlockType
  topics?: string[]
}

export type Approval = ContractEventLog<{
  owner: string
  spender: string
  value: string
  0: string
  1: string
  2: string
}>
export type Transfer = ContractEventLog<{
  from: string
  to: string
  value: string
  0: string
  1: string
  2: string
}>

export interface ERC20 extends BaseContract {
  constructor(jsonInterface: any[], address?: string, options?: ContractOptions): ERC20
  clone(): ERC20
  methods: {
    name(): NonPayableTransactionObject<string>

    approve(spender: string, value: number | string | BN): NonPayableTransactionObject<boolean>

    totalSupply(): NonPayableTransactionObject<string>

    transferFrom(from: string, to: string, value: number | string | BN): NonPayableTransactionObject<boolean>

    decimals(): NonPayableTransactionObject<string>

    balanceOf(_owner: string): NonPayableTransactionObject<string>

    symbol(): NonPayableTransactionObject<string>

    transfer(to: string, value: number | string | BN): NonPayableTransactionObject<boolean>

    allowance(_owner: string, _spender: string): NonPayableTransactionObject<string>

    increaseAllowance(spender: string, addedValue: number | string | BN): NonPayableTransactionObject<boolean>
  }
  events: {
    Approval(cb?: Callback<Approval>): EventEmitter
    Approval(options?: EventOptions, cb?: Callback<Approval>): EventEmitter

    Transfer(cb?: Callback<Transfer>): EventEmitter
    Transfer(options?: EventOptions, cb?: Callback<Transfer>): EventEmitter

    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter
  }

  once(event: 'Approval', cb: Callback<Approval>): void
  once(event: 'Approval', options: EventOptions, cb: Callback<Approval>): void

  once(event: 'Transfer', cb: Callback<Transfer>): void
  once(event: 'Transfer', options: EventOptions, cb: Callback<Transfer>): void
}
