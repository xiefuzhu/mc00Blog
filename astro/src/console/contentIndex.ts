/**
 * 站点真实内容索引客户端
 *
 * 运行时从 PHP 后端拉取:
 *  - GET /api/content/capabilities  6 个集合元信息
 *  - GET /api/content/tree          6 个集合的完整目录树 (与首页「目录」面板同源)
 *
 * 不再缓存到 localStorage: 后端不可达时返回 null, 由上层显示空内容。
 */

import { fetchCapabilities, fetchContentTree } from "./contentApi";
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

let cached: ContentIndex | null = null;

function normalize(value: string): string {
    return (value || "").trim().toLowerCase().replace(/[\s/]+/g, "");
}

function walkEntries(nodes: SiteDirectoryNode[]): SiteDirectoryNode[] {
    const result: SiteDirectoryNode[] = [];
    const walk = (list: SiteDirectoryNode[]) => {
        for (const node of list) {
            if (node.type === "entry") result.push(node);
            if (node.children?.length) walk(node.children);
        }
    };
    walk(nodes);
    return result;
}

function walkFolders(nodes: SiteDirectoryNode[]): string[] {
    const result: string[] = [];
    const walk = (list: SiteDirectoryNode[]) => {
        for (const node of list) {
            if (node.type === "folder") result.push(node.folderPath);
            if (node.children?.length) walk(node.children);
        }
    };
    walk(nodes);
    return result;
}

function toIndexEntry(node: SiteDirectoryNode): SiteIndexEntry {
    const meta = (node.meta || {}) as Record<string, unknown>;
    return {
        collection: node.collection,
        id: node.entryId || node.name,
        name: node.name,
        folderPath: node.folderPath,
        relPath: node.path.slice(node.collection.length + 1),
        filePath: node.file || "",
        url: node.url || "",
        format: (node.format as SiteEntryFormat) || "json",
        meta,
    };
}

function toPostEntry(entry: SiteIndexEntry): ContentIndexEntry {
    const meta = entry.meta || {};
    return {
        id: entry.id,
        slug: entry.id,
        url: entry.url,
        title: typeof meta.title === "string" ? meta.title : entry.name,
        directoryTitle: typeof meta.directoryTitle === "string" ? meta.directoryTitle : "",
        folderPath: entry.folderPath,
        category: (meta.category as string | string[] | null) ?? null,
        tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
        format: (entry.format === "html" || entry.format === "mdx" ? entry.format : "markdown") as ContentFormat,
        draft: meta.draft === true,
        pinned: meta.pinned === true,
        published: typeof meta.published === "string" ? meta.published : null,
        description: typeof meta.description === "string" ? meta.description : "",
        cover: typeof meta.cover === "string" ? meta.cover : "",
    };
}

/**
 * 拉取站点内容索引。
 * 后端不可达时返回 null (不退回缓存), 调用方据此显示空内容。
 */
export async function loadContentIndex(force = false): Promise<ContentIndex | null> {
    if (cached && !force) return cached;

    const [treeResult, capabilities] = await Promise.all([fetchContentTree(), fetchCapabilities()]);
    if (!treeResult.ok) return null;

    const tree = treeResult.data.tree || [];
    const entries = walkEntries(tree).map(toIndexEntry);
    const folderPaths = walkFolders(tree);

    const collections: SiteCollectionInfo[] = (capabilities.ok ? capabilities.data.collections : []).map((def) => {
        const collectionEntries = entries.filter((entry) => entry.collection === def.key);
        return {
            key: def.key,
            label: def.label,
            root: def.root,
            relRoot: def.relRoot,
            listUrl: def.listUrl,
            entryKind: def.entryKind,
            extensions: def.extensions,
            entryCount: collectionEntries.length,
            folderPaths: folderPaths.filter((path) => path.startsWith(def.relRoot + "/")),
        };
    });

    const posts = entries.filter((entry) => entry.collection === "posts").map(toPostEntry);

    cached = {
        generatedAt: new Date().toISOString(),
        collections,
        tree,
        entries,
        posts,
        folderPaths,
        postEntryCount: posts.length,
        siteEntryCount: entries.length,
    };
    return cached;
}

/** 清空内存缓存 (手动刷新时使用) */
export function clearContentIndexCache(): void {
    cached = null;
}

/** 兼容旧接口: 索引不再持久化, 恒为未同步 */
export function hasSyncedSiteIndex(): boolean {
    return false;
}

export function markSiteIndexSynced(): void {
    // 索引不再缓存, 无需标记
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
