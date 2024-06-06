import { Provider } from '@/providers/types/TokenList';
import { Chain } from '@/types';
import { readFile } from 'fs/promises';
import { createTokenList } from '@/helpers/createTokenList';
import { z } from 'zod';
import { resolve } from 'path';

const TokensSchema = z.array(
    z.object({
        chainId: z.number().nonnegative().int(),
        address: z
            .string()
            .length(42)
            .regex(/^0x[a-fA-F0-9]{40}$/, {
                message:
                    "Invalid EVM address. Must be a valid hexadecimal string starting with '0x' followed by 40 hexadecimal characters.",
            }),
        name: z.string(),
        symbol: z.string(),
        decimals: z.number().nonnegative().int(),
        logoURI: z.string().url().optional(),
    }),
);

class TokenList implements Provider {
    constructor(private pathname: string) {}

    async getFungibleTokenList(chain: Chain, signal?: AbortSignal) {
        const content = await readFile(resolve(this.pathname, `${chain.name}.json`), {
            encoding: 'utf-8',
            flag: 'r',
            signal,
        });

        const tokens = TokensSchema.parse(JSON.parse(content));
        return createTokenList(tokens);
    }
}

export const FileTokenList = new TokenList(resolve(process.cwd(), './src/assets/'));
