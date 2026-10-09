/**
 * 站点真实内容索引客户端
 * 拉取构建时生成的 /console/content-index.json, 并提供:
 *  - 6 个内容集合的完整目录树 (与首页「目录」面板同源)
 *  - 各集合的真实条目列表 (含原始 JSON 数据, 供只读环境下的查看与导出)
 *  - 控制台文章 -> 前台真实路由 的解析
 */

import type { ContentFormat, Post } from "./types";
import type {
    SiteCollectionKey,
    SiteDirectoryNode,
    SiteEntryFormat,
} from "@utils/contentCollections";

export interface ContentIndexEntry {
    id: string;
    slug: string;
    url: string;
    title: string;
    directoryTitle: string;
    folderPath: string;
    category: string | string[] | null;
    tags: string[];
    format: ContentFormat;
    draft: boolean;
    pinned: boolean;
    published: string | null;
    description: string;
    cover: string;
}

export interface SiteIndexEntry {
    collection: SiteCollectionKey;
    id: string;
    name: string;
    folderPath: string;
    relPath: string;
    filePath: string;
    url: string;
    format: SiteEntryFormat;
    meta: Record<string, unknown>;
}

export interface SiteCollectionInfo {
    key: SiteCollectionKey;
    label: string;
    root: string;
    relRoot: string;
    listUrl: string;
    entryKind: "markdown" | "json";
    extensions: string[];
    entryCount: number;
    folderPaths: string[];
}

export interface ContentIndex {
    generatedAt: string;
    collections: SiteCollectionInfo[];
    tree: SiteDirectoryNode[];
    entries: SiteIndexEntry[];
    posts: ContentIndexEntry[];
    folderPaths: string[];
    postEntryCount?: number;
    siteEntryCount?: number;
}

const INDEX_URL = "/console/content-index.json";
const CACHE_KEY = "mc00_content_index_v2";
const SYNCED_FLAG = "mc00_content_index_synced_v2";

let cached: ContentIndex | null = null;

function normalize(value: string): string {
    return (value || "").trim().toLowerCase().replace(/[\s/]+/g, "");
}

/** 读取内容索引 (优先实时拉取, 失败时退回本地缓存) */
export async function loadContentIndex(force = false): Promise<ContentIndex | null> {
    if (cached && !force) return cached;
    if (typeof window === "undefined") return null;

    try {
        const response = await fetch(INDEX_URL, { headers: { accept: "application/json" } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as ContentIndex;
        if (!data || !Array.isArray(data.posts) || !Array.isArray(data.entries)) {
            throw new Error("索引结构异常");
        }
        cached = data;
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch {
            // 忽略存储异常
        }
        return cached;
    } catch {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) {
                cached = JSON.parse(raw) as ContentIndex;
                return cached;
            }
        } catch {
            // 忽略解析异常
        }
        return null;
    }
}

/** 是否已经自动同步过一次站点目录 */
export function hasSyncedSiteIndex(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SYNCED_FLAG) === "1";
}

export function markSiteIndexSynced(): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(SYNCED_FLAG, "1");
    } catch {
        // 忽略
    }
}

/** 在索引中定位某篇文章 (依次用 contentId / slug / 标题匹配) */
export function findIndexEntry(index: ContentIndex | null, post: Post): ContentIndexEntry | null {
    if (!index) return null;
    if (post.contentId) {
        const byId = index.posts.find((entry) => normalize(entry.id) === normalize(post.contentId!));
        if (byId) return byId;
    }
    const bySlug = index.posts.find((entry) => normalize(entry.slug) === normalize(post.slug));
    if (bySlug) return bySlug;
    return index.posts.find((entry) => normalize(entry.title) === normalize(post.title)) || null;
}

/** 解析文章在前台的真实 URL (已带尾斜杠); 未匹配到站点条目时返回 null */
export function resolvePostUrl(index: ContentIndex | null, post: Post): string | null {
    const entry = findIndexEntry(index, post);
    return entry ? entry.url : null;
}

/** 从索引推导指定文件夹下的文章列表 */
export function listIndexEntriesInFolder(index: ContentIndex, folderPath: string): ContentIndexEntry[] {
    if (!folderPath) return index.posts;
    return index.posts.filter(
        (entry) => entry.folderPath === folderPath || entry.folderPath.startsWith(folderPath + "/"),
    );
}

/* -------------------------------------------------------------------------- */
/* 集合维度                                                                    */
/* -------------------------------------------------------------------------- */

export function getCollectionInfo(index: ContentIndex | null, key: SiteCollectionKey): SiteCollectionInfo | null {
    if (!index) return null;
    return index.collections.find((item) => item.key === key) || null;
}

export function getCollectionTree(index: ContentIndex | null, key: SiteCollectionKey): SiteDirectoryNode | null {
    if (!index) return null;
    return index.tree.find((node) => node.collection === key) || null;
}

/** 列出某集合内指定文件夹下的条目 (含子文件夹, 与首页目录面板层级一致) */
export function listSiteEntries(
    index: ContentIndex | null,
    key: SiteCollectionKey,
    folderPath: string | null,
    includeSubfolders = true,
): SiteIndexEntry[] {
    if (!index) return [];
    const scoped = index.entries.filter((entry) => entry.collection === key);
    if (folderPath === null) return scoped;
    const base = folderPath || "";
    if (base === "") return scoped.filter((entry) => !entry.folderPath);
    return scoped.filter((entry) => {
        if (entry.folderPath === base) return true;
        return includeSubfolders && entry.folderPath.startsWith(base + "/");
    });
}

/** 按集合与文件路径定位条目 */
export function findSiteEntry(
    index: ContentIndex | null,
    key: SiteCollectionKey,
    relPath: string,
): SiteIndexEntry | null {
    if (!index) return null;
    const target = normalize(relPath);
    return (
        index.entries.find((entry) => entry.collection === key && normalize(entry.relPath) === target) || null
    );
}
