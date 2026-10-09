/**
 * 内容集合读写 API 客户端
 *
 * 与 src/account/api/client.ts 的双模风格一致: 每个调用都自带 try/catch,
 * 失败时返回结构化错误, 由 store 决定是否降级为本地镜像。
 */

import type { SiteCollectionKey, SiteDirectoryNode } from "@utils/contentCollections";

const CONTENT_API_BASE = "/api/content";
export interface ContentApiCollection {
    key: SiteCollectionKey;
    label: string;
    root: string;
    relRoot: string;
    extensions: string[];
    entryKind: "markdown" | "json";
    listUrl: string;
}

export interface ContentCapabilities {
    writable: boolean;
    reason: string;
    contentRoot?: string;
    repoRoot?: string;
    collections: ContentApiCollection[];
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

function getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return (
        localStorage.getItem("twilight_halo_auth_token") ||
        localStorage.getItem("halo_auth_token") ||
        null
    );
}

async function callApi<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
    try {
        const token = getAuthToken();
        const headers: Record<string, string> = {
            accept: "application/json",
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...((init.headers as Record<string, string>) || {}),
        };
        const response = await fetch(`${CONTENT_API_BASE}${path}`, { ...init, headers });
        const text = await response.text();
        let payload: any = null;
        try {
            payload = text ? JSON.parse(text) : null;
        } catch {
            payload = null;
        }
        if (!response.ok || !payload || payload.ok === false) {
            const detailErrors = Array.isArray(payload?.errors) ? payload.errors : [];
            const message = [payload?.message, ...detailErrors].filter(Boolean).join("; ");
            return {
                ok: false,
                error: message || `HTTP ${response.status}`,
                status: response.status,
            };
        }
        return { ok: true, data: payload as T };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "内容服务不可达",
            status: 0,
        };
    }
}

export function fetchCapabilities(): Promise<ApiResult<ContentCapabilities>> {
    return callApi<ContentCapabilities>("/capabilities/");
}

export function fetchContentTree(): Promise<ApiResult<{ tree: SiteDirectoryNode[]; writable: boolean; reason: string }>> {
    return callApi<{ tree: SiteDirectoryNode[]; writable: boolean; reason: string }>("/tree/");
}

export function fetchEntry(
    collection: SiteCollectionKey,
    relPath: string,
): Promise<ApiResult<{ content: string; data: Record<string, unknown> | null; filePath: string }>> {
    const query = new URLSearchParams({ collection, path: relPath });
    return callApi(`/entry/?${query.toString()}`);
}

export function putEntry(
    collection: SiteCollectionKey,
    relPath: string,
    payload: { content?: string; data?: Record<string, unknown>; frontmatterKeys?: string[] },
    overwrite = true,
): Promise<ApiResult<{ created: boolean; path: string; filePath: string }>> {
    return callApi("/entry/", {
        method: "PUT",
        body: JSON.stringify({ collection, path: relPath, overwrite, ...payload }),
    });
}

export function moveEntry(
    collection: SiteCollectionKey,
    from: string,
    to: string,
    overwrite = false,
): Promise<ApiResult<{ from: string; to: string; filePath: string }>> {
    return callApi("/entry/", {
        method: "POST",
        body: JSON.stringify({ op: "move", collection, from, to, overwrite }),
    });
}

export function deleteEntry(
    collection: SiteCollectionKey,
    relPath: string,
): Promise<ApiResult<{ path: string }>> {
    const query = new URLSearchParams({ collection, path: relPath });
    return callApi(`/entry/?${query.toString()}`, { method: "DELETE" });
}

export function createFolderApi(
    collection: SiteCollectionKey,
    parent: string,
    name: string,
): Promise<ApiResult<{ path: string }>> {
    return callApi("/folder/", {
        method: "POST",
        body: JSON.stringify({ collection, parent, name }),
    });
}

export function renameFolderApi(
    collection: SiteCollectionKey,
    from: string,
    to: string,
): Promise<ApiResult<{ from: string; to: string }>> {
    return callApi("/folder/", {
        method: "PUT",
        body: JSON.stringify({ collection, from, to }),
    });
}

export function deleteFolderApi(
    collection: SiteCollectionKey,
    relPath: string,
    keepEntries: boolean,
): Promise<ApiResult<{ path: string }>> {
    const query = new URLSearchParams({ collection, path: relPath, keepEntries: String(keepEntries) });
    return callApi(`/folder/?${query.toString()}`, { method: "DELETE" });
}
