import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { parse } from 'semver'

import { CHAINS } from '@/constants/chain';
import { MaskTokenList } from '@/providers/mask/TokenList';

async function main() {
    for (const chain of CHAINS) {
        console.log(`[INFO] Fetching: ${chain.name} (${chain.chainId})`);

        try {
            const funibleTokenList = await MaskTokenList.getFungibleTokenList(chain);
            const nonFungibleTokenList = await MaskTokenList.getNonFungibleTokenList(chain);

            const PackageJSON = JSON.parse(readFileSync('./package.json', 'utf8'))
            const parsedVersion = parse(PackageJSON.version);

            funibleTokenList.version.major = parsedVersion?.major ?? 0;
            funibleTokenList.version.minor = parsedVersion?.minor ?? 0;
            funibleTokenList.version.patch = parsedVersion?.patch ?? 0;

            nonFungibleTokenList.version.major = parsedVersion?.major ?? 0;
            nonFungibleTokenList.version.minor = parsedVersion?.minor ?? 0;
            nonFungibleTokenList.version.patch = parsedVersion?.patch ?? 0;

            const isoString = new Date().toISOString();
            funibleTokenList.timestamp = isoString;
            nonFungibleTokenList.timestamp = isoString;

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
