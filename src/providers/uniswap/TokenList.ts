import { omit } from 'lodash';

import { UNISWAP_TOKEN_LIST_URL } from '@/constants';
import { fetchJSON } from '@/helpers/fetchJSON';
import { Provider } from '@/providers/types/TokenList';
import { Chain, FungibleToken, TokenList as ChainTokenList } from '@/types';

class TokenList implements Provider {
    async getFungibleTokenList(chain: Chain, signal?: AbortSignal) {
        const repsonse = await fetchJSON<ChainTokenList<FungibleToken>>(UNISWAP_TOKEN_LIST_URL, { signal });

        return {
            ...repsonse,
            tokens: repsonse.tokens.filter((x) => x.chainId === chain.chainId).map((y) => omit(y, 'extensions')),
        };
    }
}

export const UniswapTokenList = new TokenList();
