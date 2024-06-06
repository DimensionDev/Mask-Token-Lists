import { HttpsProxyAgent } from 'https-proxy-agent';

import { fetch } from '@/helpers/fetch';
import { RequestInfo as NodeFetchRequestInfo, RequestInit as NodeFetchRequestInit } from 'node-fetch';
import { NotFoundError } from '@/constants/error';

export async function fetchJSON<T = unknown>(request: RequestInfo, init?: RequestInit) {
    const proxy = process.env.http_proxy ?? process.env.https_proxy;

    const response = await fetch(
        request as NodeFetchRequestInfo,
        {
            ...init,
            agent: proxy ? new HttpsProxyAgent(proxy) : undefined,
        } as NodeFetchRequestInit,
    );
    if (response.status === 404) throw new NotFoundError();
    if (!response.ok) throw new Error(`Failed to fetch JSON: ${response.status} ${response.statusText}`);

    const json = await response.json();
    return json as T;
}
