export enum SourceType {
    LEGACY = 'legacy',
    EXPLORER = 'explorer',
    MARKETING = 'marketing',
}

export enum TokenListProviderType {
    Mask = 'Mask',
    Uniswap = 'Uniswap',
    MetaMask = 'MetaMask',
}

export enum TickerProviderType {
    DimensionAssets = 'DimensionAssets',
    CoinMarketCap = 'CoinMarketCap',
    CoinGecko = 'CoinGecko',
}

export enum SecurityType {
    High = 'High',
    Medium = 'Medium',
    Safe = 'Safe',
}

export interface Chain {
    id: string;
    name: string;
    // the numeric chain id
    chainId: number | 'solana';
    // the blockchain id on Dimension/assets
    assetId: string;
    // the blockchain id on CoinMarketCap
    coinMarketCapId: string;
    // the blockchain id on CoinGecko
    coinGeckoId: string;
}

export interface Ticker {
    // the coin id on the platform
    id: string;
    // -1 means invalid rank
    rankByMarketCap: -1 | Exclude<number, -1>;
    logoURI?: string;
    security?: SecurityType;
}

export interface Token {
    chainId: number;
    address: string;
    name: string;
    symbol: string;
    rank?: number;
    logoURI?: string;
    // extensions
    extensions?: {
        bridgeInfo: Record<
            string,
            {
                tokenAddress: string;
            }
        >;
    };
    // tickers from external API providers
    tickers?: Record<TickerProviderType, Ticker>;
}

export interface FungibleToken extends Token {
    decimals: number;
}

export interface NonFungibleToken extends Token {
    uri: string;
}

export interface TokenList<T extends Token> {
    name: string;
    logoURI: string;
    keywords: string[];
    timestamp: string;
    version: {
        major: number;
        minor: number;
        patch: number;
    };
    tokens: T[];
}
