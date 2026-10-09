/**
 * 站点内容集合注册表与目录树构建器
 *
 * 这里是控制台与博客首页「目录」面板的唯一结构来源:
 *  - 首页 src/utils/directory.ts 由本模块构建出的树映射而来, 因此两者不可能再分叉
 *  - 控制台通过 /console/content-index.json 与 /api/content/tree 取得同一棵树
 *
 * 本文件必须保持「无 Astro 内容层依赖」: 不 import astro:content、不 import 各集合的
 * import.meta.glob 数据源, 以便同时被浏览器端 (控制台) 与服务端 (API 路由) 引用。
 */

export type SiteCollectionKey =
    | "posts"
    | "albums"
    | "diary"
    | "projects"
    | "skills"
    | "timeline";

/** 条目的正文形态 (文章集合为 markdown/mdx/html, 其余集合为 json) */
export type SiteEntryFormat = "markdown" | "mdx" | "html" | "json";

export interface SiteCollectionDefinition {
    key: SiteCollectionKey;
    /** I18nKey 的原始字符串值, 用于取得与首页「目录」面板完全一致的显示名 */
    i18nKey: string;
    /** 仓库相对根目录 */
    root: string;
    /** src/content 下的相对根目录 */
    relRoot: string;
    /** 允许的扩展名 (含点号) */
    extensions: string[];
    /** 条目形态 */
    entryKind: "markdown" | "json";
    /** 前台列表页路由 */
    listUrl: string;
    /** 索引与接口都不可用时的兜底显示名 */
    fallbackLabel: string;
}

export const SITE_COLLECTIONS: SiteCollectionDefinition[] = [
    {
        key: "posts",
        i18nKey: "posts",
        root: "src/content/posts",
        relRoot: "posts",
        extensions: [".md", ".mdx", ".html"],
        entryKind: "markdown",
        listUrl: "/archive/",
        fallbackLabel: "Posts",
    },
    {
        key: "albums",
        i18nKey: "albums",
        root: "src/content/albums",
        relRoot: "albums",
        extensions: [".json"],
        entryKind: "json",
        listUrl: "/albums/",
        fallbackLabel: "Albums",
    },
    {
        key: "diary",
        i18nKey: "diary",
        root: "src/content/diary",
        relRoot: "diary",
        extensions: [".json"],
        entryKind: "json",
        listUrl: "/diary/",
        fallbackLabel: "Diary",
    },
    {
        key: "projects",
        i18nKey: "projects",
        root: "src/content/projects",
        relRoot: "projects",
        extensions: [".json"],
        entryKind: "json",
        listUrl: "/projects/",
        fallbackLabel: "Projects",
    },
    {
        key: "skills",
        i18nKey: "skills",
        root: "src/content/skills",
        relRoot: "skills",
        extensions: [".json"],
        entryKind: "json",
        listUrl: "/skills/",
        fallbackLabel: "Skills",
    },
    {
        key: "timeline",
        i18nKey: "timeline",
        root: "src/content/timeline",
        relRoot: "timeline",
        extensions: [".json"],
        entryKind: "json",
        listUrl: "/timeline/",
        fallbackLabel: "Timeline",
    },
];

export const SITE_COLLECTION_KEYS: SiteCollectionKey[] = SITE_COLLECTIONS.map((item) => item.key);

const COLLECTION_MAP = new Map<string, SiteCollectionDefinition>(
    SITE_COLLECTIONS.map((item) => [item.key, item]),
);

export function isSiteCollectionKey(value: string): value is SiteCollectionKey {
    return COLLECTION_MAP.has(value);
}

export function getCollectionDefinition(key: string): SiteCollectionDefinition | null {
    return COLLECTION_MAP.get(key) || null;
}

/** 集合显示名映射 (由构建期或服务端注入, 保证与首页面板文字一致) */
export type SiteCollectionLabels = Partial<Record<SiteCollectionKey, string>>;

/**
 * 单个内容条目 (由不同数据源归一化后的中间表示)
 * 所有路径均使用 POSIX 分隔符
 */
export interface ContentSourceEntry {
    collection: SiteCollectionKey;
    /** 集合内唯一 id (不含扩展名, 可含子目录, 例如 guide/Getting Started) */
    id: string;
    /** 相对集合根目录的完整路径 (含扩展名, 例如 guide/Getting Started.md) */
    relPath: string;
    /** 相对集合根目录的所在文件夹路径 (空串表示位于集合根目录) */
    folderPath: string;
    /** 展示名 (与首页「目录」面板一致) */
    name: string;
    /** 前台真实路由 */
    url: string;
    format: SiteEntryFormat;
    /** 仓库相对文件路径 (例如 src/content/posts/guide/Getting Started.md) */
    filePath: string;
    /** 附加元数据 (标题/日期/草稿/原始 JSON 数据等) */
    meta: Record<string, unknown>;
}

export interface SiteDirectoryNode {
    /** 相对 src/content 的唯一路径 (集合根节点为集合名) */
    path: string;
    /** 相对集合根目录的文件夹路径 (集合根节点为空串) */
    folderPath: string;
    /** 节点段名 (集合根节点为集合显示名) */
    name: string;
    /** 展示名 */
    label: string;
    type: "collection" | "folder" | "entry";
    collection: SiteCollectionKey;
    /** 递归条目数 */
    count: number;
    /** 本层直属条目数 */
    selfCount: number;
    children?: SiteDirectoryNode[];
    /** entry: 前台真实路由 */
    url?: string;
    /** entry: 仓库相对文件路径 */
    file?: string;
    /** entry: 集合内唯一 id */
    entryId?: string;
    /** entry: 正文形态 */
    format?: SiteEntryFormat;
    /** entry: 附加元数据 */
    meta?: Record<string, unknown>;
}

/** 文件夹与条目排序: 文件夹优先, 同级按名称字母序 (与首页面板一致) */
function compareNodes(a: SiteDirectoryNode, b: SiteDirectoryNode): number {
    const rank = (node: SiteDirectoryNode) => (node.type === "entry" ? 1 : 0);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return a.name.localeCompare(b.name);
}

/**
 * 由归一化条目构建 6 个根集合的完整目录树。
 * 始终返回 6 个根节点 (即使某个集合当前为空), 便于控制台稳定展示集合维度。
 * extraFolders 用于补齐「当前没有任何条目」的空文件夹 (只有真实文件系统才能枚举出来)。
 */
export function buildSiteDirectoryTree(
    entries: ContentSourceEntry[],
    labels: SiteCollectionLabels = {},
    extraFolders: Partial<Record<SiteCollectionKey, string[]>> = {},
): SiteDirectoryNode[] {
    const roots: SiteDirectoryNode[] = [];

    for (const def of SITE_COLLECTIONS) {
        const label = labels[def.key] || def.fallbackLabel;
        const root: SiteDirectoryNode = {
            path: def.key,
            folderPath: "",
            name: label,
            label,
            type: "collection",
            collection: def.key,
            count: 0,
            selfCount: 0,
            children: [],
        };

        const folders = new Map<string, SiteDirectoryNode>();

        const ensureFolder = (folderPath: string): SiteDirectoryNode => {
            const existing = folders.get(folderPath);
            if (existing) return existing;
            const segments = folderPath.split("/");
            const name = segments[segments.length - 1];
            const node: SiteDirectoryNode = {
                path: `${def.key}/${folderPath}`,
                folderPath,
                name,
                label: name,
                type: "folder",
                collection: def.key,
                count: 0,
                selfCount: 0,
                children: [],
            };
            folders.set(folderPath, node);
            const parentPath = segments.slice(0, -1).join("/");
            const parent = parentPath ? ensureFolder(parentPath) : root;
            parent.children!.push(node);
            return node;
        };

        for (const folderPath of extraFolders[def.key] || []) {
            if (folderPath) ensureFolder(folderPath.replace(/^\/+|\/+$/g, ""));
        }

        for (const entry of entries) {
            if (entry.collection !== def.key) continue;

            const parent = entry.folderPath ? ensureFolder(entry.folderPath) : root;
            parent.children!.push({
                path: `${def.key}/${entry.relPath}`,
                folderPath: entry.folderPath,
                name: entry.name,
                label: entry.name,
                type: "entry",
                collection: def.key,
                count: 0,
                selfCount: 0,
                url: entry.url,
                file: entry.filePath,
                entryId: entry.id,
                format: entry.format,
                meta: entry.meta,
            });
            parent.selfCount += 1;
        }

        const finalize = (node: SiteDirectoryNode): number => {
            let total = node.selfCount;
            for (const child of node.children || []) total += finalize(child);
            node.count = total;
            node.children?.sort(compareNodes);
            return total;
        };
        finalize(root);

        roots.push(root);
    }

    return roots;
}

/** 深度优先收集指定集合内的全部文件夹路径 (集合相对) */
export function collectFolderPaths(nodes: SiteDirectoryNode[], collection: SiteCollectionKey): string[] {
    const result: string[] = [];
    const walk = (node: SiteDirectoryNode) => {
        if (node.collection !== collection) return;
        if (node.type === "folder") result.push(node.folderPath);
        for (const child of node.children || []) walk(child);
    };
    for (const root of nodes) walk(root);
    return result;
}

/** 深度优先收集指定集合内的全部条目 */
export function collectEntries(nodes: SiteDirectoryNode[], collection: SiteCollectionKey): SiteDirectoryNode[] {
    const result: SiteDirectoryNode[] = [];
    const walk = (node: SiteDirectoryNode) => {
        if (node.collection !== collection) return;
        if (node.type === "entry") result.push(node);
        for (const child of node.children || []) walk(child);
    };
    for (const root of nodes) walk(root);
    return result;
}

/** 在树中按 path 定位节点 */
export function findNodeByPath(nodes: SiteDirectoryNode[], path: string): SiteDirectoryNode | null {
    const walk = (list: SiteDirectoryNode[]): SiteDirectoryNode | null => {
        for (const node of list) {
            if (node.path === path) return node;
            const found = node.children ? walk(node.children) : null;
            if (found) return found;
        }
        return null;
    };
    return walk(nodes);
}

/** 判断 folderPath 是否落在 target 文件夹内 (含自身; target 为空串表示集合根目录) */
export function isFolderWithin(folderPath: string, target: string): boolean {
    const current = folderPath || "";
    const base = target || "";
    if (base === "") return true;
    return current === base || current.startsWith(base + "/");
}
