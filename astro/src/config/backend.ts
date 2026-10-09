/**
 * 前后端通信配置
 *
 * 读取 astro 根目录的 backend.config.json，并允许通过环境变量覆盖：
 *  - PUBLIC_MC00_BACKEND_URL  覆盖 baseUrl
 *  - PUBLIC_MC00_AUTH_KEY     覆盖 authKey
 *
 * 浏览器端还支持运行时覆盖 baseUrl（写入 localStorage），便于本地联调时
 * 把前端指向不同的后端实例，而无需重新构建。
 */

import rawConfig from "../../backend.config.json";

export interface BackendConfig {
    /** 后端 REST API 根地址，例如 http://127.0.0.1:8000/api */
    baseUrl: string;
    /** 与后端共享的鉴权密钥 */
    authKey: string;
    /** 单次请求超时（毫秒） */
    timeoutMs: number;
    /** 健康检查路径（相对 baseUrl） */
    healthPath: string;
}

const fileConfig = rawConfig as Partial<BackendConfig>;

function nonEmpty(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, "");
}

/** 构建期配置（配置文件 + 环境变量） */
export const backendConfig: BackendConfig = {
    baseUrl: trimTrailingSlash(
        nonEmpty(import.meta.env.PUBLIC_MC00_BACKEND_URL) ??
            nonEmpty(fileConfig.baseUrl) ??
            "http://127.0.0.1:8000/api",
    ),
    authKey: nonEmpty(import.meta.env.PUBLIC_MC00_AUTH_KEY) ?? nonEmpty(fileConfig.authKey) ?? "",
    timeoutMs: Number(fileConfig.timeoutMs) > 0 ? Number(fileConfig.timeoutMs) : 4000,
    healthPath: nonEmpty(fileConfig.healthPath) ?? "/stats",
};

const BASE_URL_OVERRIDE_KEY = "mc00_backend_base";

/** 运行时后端地址（浏览器端可被 localStorage 覆盖） */
export function getBackendBaseUrl(): string {
    if (typeof window !== "undefined") {
        const override = window.localStorage.getItem(BASE_URL_OVERRIDE_KEY);
        if (override) return trimTrailingSlash(override);
    }
    return backendConfig.baseUrl;
}

/** 设置运行时后端地址覆盖（传空串则清除） */
export function setBackendBaseUrl(url: string): void {
    if (typeof window === "undefined") return;
    const normalized = url.trim();
    if (normalized) {
        window.localStorage.setItem(BASE_URL_OVERRIDE_KEY, trimTrailingSlash(normalized));
    } else {
        window.localStorage.removeItem(BASE_URL_OVERRIDE_KEY);
    }
}

/** 共享鉴权密钥 */
export function getAuthKey(): string {
    return backendConfig.authKey;
}

/** 请求超时（毫秒） */
export function getRequestTimeout(): number {
    return backendConfig.timeoutMs;
}

/** 健康检查地址 */
export function getHealthUrl(): string {
    return `${getBackendBaseUrl()}${backendConfig.healthPath}`;
}
