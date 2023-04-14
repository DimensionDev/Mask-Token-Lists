import { ChainId, FungibleToken } from '../type'
import { getLatestReleasedTokenList, isSameAddress } from '../utils/helpers'
import { explorerFetchMapping, explorerPagesMapping } from '../utils/base'
import { writeTokensToFile } from '../utils'

export async function rankByMarketCap(chainId: ChainId, toAddList?: FungibleToken[]) {
  const fetch = explorerFetchMapping[chainId]
  const fetchPage = explorerPagesMapping[chainId]?.[0]

  if (!fetch || !fetchPage) return
  const tokenList: FungibleToken[] = toAddList ?? (await getLatestReleasedTokenList(chainId))

  const tokenListWithRank = await fetch(fetchPage)

  const results = tokenList.map((x) => {
    const tokenWithRank = tokenListWithRank.find((y) => isSameAddress(x.address, y.address))
    return tokenWithRank?.rank ? { ...x, rank: tokenWithRank.rank } : x
  })

  if (results.length && !toAddList) {
    await writeTokensToFile(chainId, results)
  }

  process.exit(0)
}