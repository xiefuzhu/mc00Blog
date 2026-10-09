/**
 * 内容集合读写 API 客户端
 *
 * 指向 PHP 后端的 /api/content/* 接口 (见 php/README.md)。
 * 所有调用都经统一客户端 backendRequest, 失败时返回结构化错误,
 * 由 store 决定如何提示 (不再有本地文件系统兜底)。
 */

import { backendRequest, type ApiResult } from "@/lib/backend";

export type { ApiResult };

import type { SiteCollectionKey, SiteDirectoryNode } from "@utils/contentCollections";

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

export function fetchCapabilities(): Promise<ApiResult<ContentCapabilities>> {
    return backendRequest<ContentCapabilities>("/content/capabilities");
}

export function fetchContentTree(): Promise<ApiResult<{ tree: SiteDirectoryNode[]; writable: boolean; reason: string }>> {
    return backendRequest<{ tree: SiteDirectoryNode[]; writable: boolean; reason: string }>("/content/tree");
}

export function fetchEntry(
    collection: SiteCollectionKey,
    relPath: string,
): Promise<ApiResult<{ content: string; data: Record<string, unknown> | null; filePath: string }>> {
    const query = new URLSearchParams({ collection, path: relPath });
    return backendRequest(`/content/entry?${query.toString()}`);
}

export function putEntry(
    collection: SiteCollectionKey,
    relPath: string,
    payload: { content?: string; data?: Record<string, unknown>; frontmatterKeys?: string[] },
    overwrite = true,
): Promise<ApiResult<{ created: boolean; path: string; filePath: string }>> {
    return backendRequest("/content/entry", {
        method: "PUT",
        body: { collection, path: relPath, overwrite, ...payload },
    });
}

export function moveEntry(
    collection: SiteCollectionKey,
    from: string,
    to: string,
    overwrite = false,
): Promise<ApiResult<{ from: string; to: string; filePath: string }>> {
    return backendRequest("/content/entry", {
        method: "POST",
        body: { op: "move", collection, from, to, overwrite },
    });
}

export function deleteEntry(
    collection: SiteCollectionKey,
    relPath: string,
): Promise<ApiResult<{ path: string }>> {
    const query = new URLSearchParams({ collection, path: relPath });
    return backendRequest(`/content/entry?${query.toString()}`, { method: "DELETE" });
}

export function createFolderApi(
    collection: SiteCollectionKey,
    parent: string,
    name: string,
): Promise<ApiResult<{ path: string }>> {
    return backendRequest("/content/folder", {
        method: "POST",
        body: { collection, parent, name },
    });
}

export function renameFolderApi(
    collection: SiteCollectionKey,
    from: string,
    to: string,
): Promise<ApiResult<{ from: string; to: string }>> {
    return backendRequest("/content/folder", {
        method: "PUT",
        body: { collection, from, to },
    });
}

export function deleteFolderApi(
    collection: SiteCollectionKey,
    relPath: string,
    keepEntries: boolean,
): Promise<ApiResult<{ path: string }>> {
    const query = new URLSearchParams({ collection, path: relPath, keepEntries: String(keepEntries) });
    return backendRequest(`/content/folder?${query.toString()}`, { method: "DELETE" });
}
