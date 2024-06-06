import { DEFAULT_TOKEN_LIST_SETTINGS } from '@/constants';
import { Token, TokenList } from '@/types';

export function createTokenList<T extends Token>(tokens: T[]): TokenList<T> {
    return {
        ...DEFAULT_TOKEN_LIST_SETTINGS,
        timestamp: new Date().toISOString(),
        version: {
            major: 0,
            minor: 0,
            patch: 0,
        },
        tokens,
    };
}
