import { Ticker, Token } from '@/types';

export interface Provider {
    getTicker(token: Token, signal?: AbortSignal): Promise<Ticker | null>;
}
