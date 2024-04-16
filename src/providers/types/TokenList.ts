import { Chain, FungibleToken, NonFungibleToken, TokenList } from '@/types';

export interface Provider {
    getFungibleTokenList(chain: Chain, signal?: AbortSignal): Promise<TokenList<FungibleToken>>;
    getNonFungibleTokenList?(chain: Chain, signal?: AbortSignal): Promise<TokenList<NonFungibleToken>>;
}
