import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { parse } from 'semver';

import { CHAINS } from '@/constants/chain';
import { MaskTokenList } from '@/providers/mask/TokenList';
import { DEFAULT_TOKEN_LIST_SETTINGS } from '@/constants';
import { Chain } from '@/types';
import { FileTokenList } from '@/providers/fs/TokenList';

function readPackageVersion() {
    const PackageJSON = JSON.parse(readFileSync('./package.json', 'utf8'));
    const parsedVersion = parse(PackageJSON.version);
    return {
        major: parsedVersion?.major ?? 0,
        minor: parsedVersion?.minor ?? 0,
        patch: parsedVersion?.patch ?? 0,
    };
}

async function loadTokenLists(chain: Chain) {
    if (chain.fileId) {
        return {
            funibleTokenList: await FileTokenList.getFungibleTokenList(chain),
        };
    } else {
        return {
            funibleTokenList: await MaskTokenList.getFungibleTokenList(chain),
            nonFungibleTokenList: await MaskTokenList.getNonFungibleTokenList(chain),
        };
    }
}

async function main() {
    const isoString = new Date().toISOString();
    const version = readPackageVersion();

    for (const chain of CHAINS) {
        console.log(`[INFO] Fetching: ${chain.name} (${chain.chainId})`);

        try {
            const { funibleTokenList, nonFungibleTokenList } = await loadTokenLists(chain);

            if (funibleTokenList) {
                Object.assign(funibleTokenList.version, version);
                Object.assign(funibleTokenList, DEFAULT_TOKEN_LIST_SETTINGS);
                funibleTokenList.timestamp = isoString;

                mkdirSync(`./dist/latest/${chain.chainId}`, { recursive: true });
                writeFileSync(`./dist/latest/${chain.chainId}/tokens.json`, JSON.stringify(funibleTokenList));
            }

            if (nonFungibleTokenList) {
                Object.assign(funibleTokenList.version, version);
                Object.assign(nonFungibleTokenList, DEFAULT_TOKEN_LIST_SETTINGS);
                nonFungibleTokenList.timestamp = isoString;

                writeFileSync(
                    `./dist/latest/${chain.chainId}/non-fungible-tokens.json`,
                    JSON.stringify(nonFungibleTokenList),
                );
            }
        } catch (error) {
            console.error(`[ERROR] Fetching: ${chain.name} (${chain.chainId})`);
            console.error(error);
            throw error;
        }
    }
}

main();
