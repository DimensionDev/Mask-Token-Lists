import { ChainId, FungibleToken } from '../type'
import { getLatestReleasedTokenList, isSameAddress } from '../utils/helpers'
import { explorerFetchMapping, explorerPagesMapping } from '../utils/base'

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

  console.log({ tokenListWithRank })

  // const results = allSettled
  //   .map((x) => (x.status === 'fulfilled' && x.value ? x.value : undefined))
  //   .filter((x) => Boolean(x)) as FungibleToken[]

  // if (results.length && !toAddList) {
  //   await writeTokensToFile(chainId, results)
  //   process.exit(0)
  // } else {
  //   return results
  // }
}
