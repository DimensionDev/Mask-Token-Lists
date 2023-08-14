import path from 'node:path'
import { ChainId, FungibleToken } from '../type'
import { writeTokensToFile } from '../utils'
import * as fs from 'node:fs/promises'

export async function generateFromStaticFile(targetChains: ChainId[]) {
  for (const chain of targetChains) {
    const chainName = Object.keys(ChainId)[Object.values(ChainId).indexOf(chain)].toLowerCase()
    // @ts-ignore
    const dir = path.join(process.env.PWD, `public/fungible-tokens/${chainName}.json`)
    const content = await fs.readFile(dir, { encoding: 'utf-8' })
    const tokenList = JSON.parse(content) as FungibleToken[]
    await writeTokensToFile(chain, tokenList)
  }
}
