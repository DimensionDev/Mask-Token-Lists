import { omit } from 'lodash';
import urlcat from 'urlcat';

import { MASK_TOKEN_LIST_ROOT_URL } from '@/constants';
import { fetchJSON } from '@/helpers/fetchJSON';
import { Provider } from '@/providers/types/TokenList';
import { Chain, FungibleToken, NonFungibleToken, TokenList as ChainTokenList } from '@/types';
import { NotFoundError } from '@/constants/error';
import { createTokenList } from '@/helpers/createTokenList';

class TokenList implements Provider {
    async getFungibleTokenList(chain: Chain, signal?: AbortSignal) {
        const url = urlcat(MASK_TOKEN_LIST_ROOT_URL, '/latest/:chainId/tokens.json', {
            chainId: chain.chainId,
        });
        const tokenList = await fetchJSON<ChainTokenList<FungibleToken>>(url, { signal });
        return {
            ...tokenList,
            tokens: tokenList.tokens.map((x) => omit(x, ['isFromContract']) as typeof x),
        };
    }

    async getNonFungibleTokenList(chain: Chain, signal?: AbortSignal): Promise<ChainTokenList<NonFungibleToken>> {
        try {
            const url = urlcat(MASK_TOKEN_LIST_ROOT_URL, '/latest/:chainId/non-fungible-tokens.json', {
                chainId: chain.chainId,
            });
            return await fetchJSON<ChainTokenList<NonFungibleToken>>(url, { signal });
        } catch (error) {
            if (error instanceof NotFoundError) {
                return createTokenList([]);
            }
            throw error;
        }
    }
}

export const MaskTokenList = new TokenList();
