import { mkdirSync, writeFileSync } from 'fs';

import { CHAINS } from '@/constants/chain';
import { MaskTokenList } from '@/providers/mask/TokenList';

async function main() {
    for (const chain of CHAINS) {
        console.log(`[INFO] Fetching: ${chain.name} (${chain.chainId})`);

        try {
            const funibleTokenList = await MaskTokenList.getFungibleTokenList(chain);
            const nonFungibleTokenList = await MaskTokenList.getNonFungibleTokenList(chain);

            console.log(`[INFO] Saving: ${chain.name} (${chain.chainId})\n`);

            mkdirSync(`./dist/latest/${chain.chainId}`, { recursive: true });
            writeFileSync(`./dist/latest/${chain.chainId}/tokens.json`, JSON.stringify(funibleTokenList));
            writeFileSync(`./dist/latest/${chain.chainId}/non-fungible-tokens.json`, JSON.stringify(nonFungibleTokenList));
        } catch (error) {
            console.error(`[ERROR] Fetching: ${chain.name} (${chain.chainId})`);
            console.error(error);
        }
    }
}

main();
