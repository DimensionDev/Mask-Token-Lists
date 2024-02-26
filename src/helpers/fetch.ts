import NodeFetchCache, { FileSystemCache } from 'node-fetch-cache';

export const fetch = NodeFetchCache.create({
    cache: new FileSystemCache({
        cacheDirectory: './.cache',
    }),
});
