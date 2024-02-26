declare namespace NodeJS {
    interface ProcessEnv {
        http_proxy?: string;
        https_proxy?: string;
    }
}
