/**
 * 前后端通信客户端 (唯一出口)
 *
 * 所有与 PHP 后端的 HTTP 交互都必须经过这里:
 *  - 从 astro 根目录的 backend.config.json 读取地址、密钥与超时
 *  - 自动携带凭据: 优先登录令牌, 其次共享密钥
 *  - 统一超时与错误处理, 不做任何本地兜底 (后端不可达时明确失败)
 */

import { getAuthKey, getBackendBaseUrl, getHealthUrl, getRequestTimeout } from "@/config/backend";

/** 控制台会话令牌的存储键 (与 authStore / contentApi 共用) */
export const AUTH_TOKEN_KEY = "twilight_halo_auth_token";
const LEGACY_AUTH_TOKEN_KEY = "halo_auth_token";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

export type ResponseMode = "raw" | "envelope";

export interface BackendRequestOptions {
    method?: string;
    /** 请求体对象 (自动 JSON 序列化) */
    body?: unknown;
    /**
     * 响应形态:
     *  - raw:      { ok, ... } (content / public 接口), 返回整个响应体
     *  - envelope: { success, data, message } (业务接口), 返回 data 字段
     */
    mode?: ResponseMode;
    timeoutMs?: number;
    signal?: AbortSignal;
    /** 附加请求头 */
    headers?: Record<string, string>;
    /** 是否携带凭据 (默认 true) */
    auth?: boolean;
}

/** 读取当前会话令牌 (若有) */
export function getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || window.localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
    if (typeof window === "undefined") return;
    if (token) {
        window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    }
}

/** 组合请求凭据: 登录令牌优先, 否则退回共享密钥 */
function resolveCredential(): string {
    return getAuthToken() || getAuthKey();
}

export function buildUrl(path: string): string {
    const base = getBackendBaseUrl();
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalized}`;
}

/**
 * 发起后端请求。网络异常/超时/HTTP 错误/业务失败都会返回 { ok: false }。
 */
export async function backendRequest<T>(path: string, options: BackendRequestOptions = {}): Promise<ApiResult<T>> {
    const mode: ResponseMode = options.mode ?? "raw";
    const timeoutMs = options.timeoutMs ?? getRequestTimeout();

    const headers: Record<string, string> = {
        accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.headers ?? {}),
    };

    if (options.auth !== false) {
        const credential = resolveCredential();
        if (credential) headers["Authorization"] = `Bearer ${credential}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (options.signal) {
        options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    let response: Response;
    try {
        response = await fetch(buildUrl(path), {
            method: options.method ?? "GET",
            headers,
            body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
            signal: controller.signal,
        });
    } catch {
        clearTimeout(timer);
        return { ok: false, error: "后端未连接或请求超时", status: 0 };
    }
    clearTimeout(timer);

    const text = await response.text().catch(() => "");
    let payload: any = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = null;
        }
    }

    if (mode === "envelope") {
        if (!response.ok || !payload || payload.success !== true) {
            return {
                ok: false,
                error: payload?.message || `HTTP ${response.status}`,
                status: response.status,
            };
        }
        return { ok: true, data: payload.data as T };
    }

    if (!response.ok || !payload || payload.ok === false) {
        const errors = Array.isArray(payload?.errors) ? payload.errors : [];
        const message = [payload?.message, ...errors].filter(Boolean).join("; ");
        return { ok: false, error: message || `HTTP ${response.status}`, status: response.status };
    }
    return { ok: true, data: payload as T };
}

export interface BackendStatus {
    online: boolean;
    latency: number;
    message: string;
}

/** 后端连通性探测 (带共享密钥的健康检查) */
export async function pingBackend(): Promise<BackendStatus> {
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    const result = await backendRequest<unknown>("/stats", { timeoutMs: 2500 });
    const latency = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - started);
    if (result.ok) {
        return { online: true, latency, message: `连接正常 (${latency}ms)` };
    }
    return { online: false, latency: 0, message: result.error };
}

export { getHealthUrl };
