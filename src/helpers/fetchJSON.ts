import { HttpsProxyAgent } from 'https-proxy-agent';
import { RequestInfo, RequestInit } from 'node-fetch';

import { fetch } from '@/helpers/fetch';

export async function fetchJSON<T = unknown>(request: RequestInfo, init?: RequestInit) {
    const proxy = process.env.http_proxy ?? process.env.https_proxy;

    const response = await fetch(request, {
        ...init,
        agent: proxy ? new HttpsProxyAgent(proxy) : undefined,
    });
    if (!response.ok) throw new Error(`Failed to fetch JSON: ${response.status} ${response.statusText}`);

    const json = await response.json();
    return json as T;
}
