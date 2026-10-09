/**
 * 博客内容与系统业务数据状态机 (Svelte 5 响应式)
 * 规范：绝对禁止输出任何 Emoji 表情符号
 */

import type {
    Post,
    Category,
    Tag,
    Attachment,
    SiteSettings,
    ConsoleTab,
    AuditLog,
    ThroughputData,
    FullBackupBundle,
    ArticleFolder,
    ArticleFolderNode,
    ContentFormat,
} from "./types";
import {
    DEFAULT_POSTS,
    DEFAULT_CATEGORIES,
    DEFAULT_TAGS,
    DEFAULT_ATTACHMENTS,
    DEFAULT_SETTINGS,
} from "./mockData";
import { countWords, getReadingTime } from "./markdown";
import { categoriesApi, tagsApi, attachmentsApi, statsApi, logsApi, settingsApi } from "./api";
import {
    loadContentIndex,
    markSiteIndexSynced,
    hasSyncedSiteIndex,
    resolvePostUrl,
    type ContentIndex,
    type SiteIndexEntry,
    type SiteCollectionInfo,
} from "./contentIndex";
import {
    createFolderApi,
    deleteEntry as deleteEntryApi,
    deleteFolderApi,
    fetchCapabilities,
    fetchContentTree,
    fetchEntry,
    moveEntry as moveEntryApi,
    putEntry,
    renameFolderApi,
} from "./contentApi";
import {
    SITE_COLLECTIONS,
    type SiteCollectionKey,
    type SiteDirectoryNode,
} from "@utils/contentCollections";
import {
    createDefaultEntry,
    getCollectionSchema,
    isJsonCollectionKey,
    slugifyEntryName,
} from "@utils/contentSchemas";

const BLOG_STORAGE_KEY = "twilight_halo_blog_v3";
const BLOG_LOGS_STORAGE_KEY = "twilight_halo_logs_v3";

/** 回收站伪路径 (与 PostsView 保持一致) */
export const RECYCLE_PATH = "__recycle__";

/** 内置示例文章 id: 一旦站点真实索引可用, 这些 mock 记录会被真实文章取代 */
const SEED_POST_IDS = new Set(DEFAULT_POSTS.map((post) => post.id));

/** 文件夹与条目排序: 文件夹优先, 同级按名称字母序 (与首页「目录」面板一致) */
function compareSiteNodes(a: SiteDirectoryNode, b: SiteDirectoryNode): number {
    const rank = (node: SiteDirectoryNode) => (node.type === "entry" ? 1 : 0);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return a.name.localeCompare(b.name);
}

const INITIAL_LOGS: AuditLog[] = [
    {
        id: "log-1",
        action: "系统服务就绪",
        detail: "管理控制台初始化完成，双模数据驱动加载成功",
        level: "success",
        operator: "system",
        ip: "127.0.0.1",
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
        id: "log-2",
        action: "管理员登录",
        detail: "超级管理员登录控制台，进入仪表盘",
        level: "info",
        operator: "admin",
        ip: "127.0.0.1",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
    {
        id: "log-3",
        action: "实时吞吐调度",
        detail: "聚合调度 20 桶时间粒度请求，成功率稳定在 98.7%",
        level: "success",
        operator: "system",
        ip: "127.0.0.1",
        timestamp: new Date(Date.now() - 600000).toISOString(),
    },
];

class BlogStore {
    // 响应式状态
    posts = $state<Post[]>([]);
    categories = $state<Category[]>([]);
    tags = $state<Tag[]>([]);
    attachments = $state<Attachment[]>([]);
    settings = $state<SiteSettings>({ ...DEFAULT_SETTINGS });
    logs = $state<AuditLog[]>([]);
    throughput = $state<ThroughputData | null>(null);
    /** 文章文件夹 (与首页「目录」面板同源的真实内容目录结构) */
    folders = $state<ArticleFolder[]>([]);
    /** 站点真实内容集合目录树 (6 个根集合, 与首页「目录」面板同源) */
    siteTree = $state<SiteDirectoryNode[]>([]);
    /** 站点真实内容集合元信息 */
    siteCollections = $state<SiteCollectionInfo[]>([]);
    /** 站点真实内容条目 (扁平, 含原始 JSON 数据) */
    siteEntries = $state<SiteIndexEntry[]>([]);
    /** 当前浏览的内容集合 */
    selectedCollection = $state<SiteCollectionKey>("posts");
    /** 内容写回能力 (仅本地开发或显式开启的常驻服务可用) */
    contentWritable = $state<boolean>(false);
    contentWriteReason = $state<string>("");
    /** 站点目录同步状态 */
    siteSyncing = $state<boolean>(false);

    // 工作台视图状态
    activeTab = $state<ConsoleTab>("dashboard");
    editingPostId = $state<string | null>(null);

    // 筛选与检索状态
    postSearchKeyword = $state<string>("");
    postStatusFilter = $state<"all" | "published" | "draft" | "recycle">("all");
    postCategoryFilter = $state<string>("all");
    /** 当前选中的文件夹路径; null 表示不限制文件夹 (全部文章) */
    selectedFolderPath = $state<string | null>(null);
    /** 是否同时显示子文件夹中的文章 */
    includeSubfolders = $state<boolean>(true);
    /** 编辑器默认落库的文件夹路径 */
    composerFolderPath = $state<string>("");
    /** 文件夹树的展开状态 (按 path 记录) */
    folderExpanded = $state<Record<string, boolean>>({});

    // 派生统计数据
    stats = $derived.by(() => {
        const publishedCount = this.posts.filter((p) => p.status === "published").length;
        const draftCount = this.posts.filter((p) => p.status === "draft").length;
        const recycleCount = this.posts.filter((p) => p.status === "recycle").length;
        const totalWords = this.posts.reduce((sum, p) => sum + (p.wordCount || 0), 0);

        return {
            totalPosts: this.posts.length - recycleCount,
            publishedCount,
            draftCount,
            recycleCount,
            totalCategories: this.categories.length,
            totalTags: this.tags.length,
            totalAttachments: this.attachments.length,
            totalWords,
        };
    });

    // 筛选后的文章列表
    filteredPosts = $derived.by(() => {
        return this.posts.filter((post) => {
            // 状态过滤
            if (this.postStatusFilter === "all") {
                if (post.status === "recycle") return false; // 常规列表不显示回收站
            } else if (post.status !== this.postStatusFilter) {
                return false;
            }

            // 文件夹过滤 (与首页「目录」面板的目录层级一致)
            if (this.selectedFolderPath !== null) {
                const target = this.selectedFolderPath;
                const current = post.folderPath || "";
                if (target === "") {
                    // 根目录: 只显示没有归入任何文件夹的文章
                    if (current !== "") return false;
                } else if (this.includeSubfolders) {
                    if (current !== target && !current.startsWith(target + "/")) return false;
                } else if (current !== target) {
                    return false;
                }
            }

            // 分类过滤
            if (this.postCategoryFilter !== "all") {
                if (!post.categories.includes(this.postCategoryFilter)) return false;
            }

            // 搜索关键词过滤
            if (this.postSearchKeyword.trim()) {
                const kw = this.postSearchKeyword.toLowerCase();
                const matchTitle = post.title.toLowerCase().includes(kw);
                const matchSummary = (post.summary || "").toLowerCase().includes(kw);
                const matchSlug = (post.slug || "").toLowerCase().includes(kw);
                if (!matchTitle && !matchSummary && !matchSlug) return false;
            }

            return true;
        });
    });

    /** 当前集合的文件夹树 (带本层与累计条目数) */
    folderTree = $derived.by<ArticleFolderNode[]>(() => this.buildFolderNodes(this.selectedCollection));

    /** 文章集合的文件夹树 (供文章编辑器与文件夹弹窗使用, 与当前浏览集合无关) */
    postsFolderTree = $derived.by<ArticleFolderNode[]>(() => this.buildFolderNodes("posts"));

    /** 当前集合的扁平化文件夹选项 (含层级深度, 供移动/选择弹窗使用) */
    folderOptions = $derived.by<{ folder: ArticleFolder; depth: number }[]>(() =>
        this.flattenFolderNodes(this.folderTree),
    );

    /** 文章集合的扁平化文件夹选项 */
    postsFolderOptions = $derived.by<{ folder: ArticleFolder; depth: number }[]>(() =>
        this.flattenFolderNodes(this.postsFolderTree),
    );

    /** 当前集合的根节点 (含全部真实文件夹与条目) */
    currentCollectionTree = $derived.by<SiteDirectoryNode | null>(
        () => this.consoleTree.find((node) => node.collection === this.selectedCollection) || null,
    );

    /** 当前集合的元信息 */
    currentCollectionInfo = $derived.by<SiteCollectionInfo | null>(
        () => this.siteCollections.find((item) => item.key === this.selectedCollection) || null,
    );

    /** 当前集合显示名 */
    currentCollectionLabel = $derived.by<string>(() => {
        const info = this.currentCollectionInfo;
        if (info) return info.label;
        return SITE_COLLECTIONS.find((item) => item.key === this.selectedCollection)?.fallbackLabel || "Posts";
    });

    /** 当前集合指定文件夹下的条目 (posts 集合由文章列表另行渲染) */
    currentEntries = $derived.by<SiteIndexEntry[]>(() => {
        if (this.selectedCollection === "posts" && this.postStatusFilter === "recycle") return [];
        const scoped = this.siteEntries.filter((entry) => entry.collection === this.selectedCollection);
        const scope = this.selectedFolderPath;
        if (scope === null || scope === RECYCLE_PATH) return scoped;
        const base = scope || "";
        if (base === "") return scoped.filter((entry) => !entry.folderPath);
        return scoped.filter(
            (entry) =>
                entry.folderPath === base ||
                (this.includeSubfolders && entry.folderPath.startsWith(base + "/")),
        );
    });

    /**
     * 控制台渲染用的完整目录树:
     * 文件夹来自可变的 folders (真实目录 + 未落盘的本地镜像), 条目来自站点真实索引。
     */
    consoleTree = $derived.by<SiteDirectoryNode[]>(() => {
        const foldersByCollection = new Map<SiteCollectionKey, ArticleFolder[]>();
        for (const folder of this.folders) {
            const list = foldersByCollection.get(folder.collection) || [];
            list.push(folder);
            foldersByCollection.set(folder.collection, list);
        }
        const entriesByCollection = new Map<SiteCollectionKey, SiteIndexEntry[]>();
        for (const entry of this.siteEntries) {
            const list = entriesByCollection.get(entry.collection) || [];
            list.push(entry);
            entriesByCollection.set(entry.collection, list);
        }

        return SITE_COLLECTIONS.map((def) => {
            const info = this.siteCollections.find((item) => item.key === def.key);
            const label = info?.label || def.fallbackLabel;
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
            const nodeByPath = new Map<string, SiteDirectoryNode>();

            const ensureFolder = (folderPath: string): SiteDirectoryNode => {
                const existing = nodeByPath.get(folderPath);
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
                nodeByPath.set(folderPath, node);
                const parentPath = segments.slice(0, -1).join("/");
                const parent = parentPath ? ensureFolder(parentPath) : root;
                parent.children!.push(node);
                return node;
            };

            for (const folder of foldersByCollection.get(def.key) || []) ensureFolder(folder.path);

            for (const entry of entriesByCollection.get(def.key) || []) {
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
                node.children?.sort(compareSiteNodes);
                return total;
            };
            finalize(root);
            return root;
        });
    });

    /** 未归档 (位于集合根目录) 的条目数 */
    unfiledCount = $derived.by(() => {
        if (this.selectedCollection === "posts") {
            return this.posts.filter((p) => p.status !== "recycle" && !(p.folderPath || "")).length;
        }
        return this.siteEntries.filter(
            (entry) => entry.collection === this.selectedCollection && !entry.folderPath,
        ).length;
    });

    /** 当前选中文件夹的展示对象 (面包屑) */
    selectedFolder = $derived.by(() => {
        if (this.selectedFolderPath === null || this.selectedFolderPath === RECYCLE_PATH) return null;
        return (
            this.folders.find(
                (folder) =>
                    folder.collection === this.selectedCollection && folder.path === this.selectedFolderPath,
            ) || null
        );
    });

    /** 按文件夹 id 取得文件夹路径 */
    folderPathById(id: string | null): string {
        if (!id) return "";
        return this.folders.find((f) => f.id === id)?.path || "";
    }

    /** 按集合与路径定位文件夹 */
    findFolder(collection: SiteCollectionKey, path: string): ArticleFolder | null {
        return this.folders.find((folder) => folder.collection === collection && folder.path === path) || null;
    }

    /** 判断文件夹是否展开 (默认展开) */
    isFolderExpanded(collection: SiteCollectionKey, path: string): boolean {
        return this.folderExpanded[`${collection}:${path}`] !== false;
    }

    toggleFolderExpanded(collection: SiteCollectionKey, path: string): void {
        const key = `${collection}:${path}`;
        this.folderExpanded = { ...this.folderExpanded, [key]: !this.isFolderExpanded(collection, path) };
    }

    expandAllFolders(): void {
        this.folderExpanded = {};
    }

    collapseAllFolders(): void {
        const next: Record<string, boolean> = { ...this.folderExpanded };
        for (const folder of this.folders) {
            next[`${folder.collection}:${folder.path}`] = false;
        }
        this.folderExpanded = next;
    }

    /** 由 folders 构建指定集合的文件夹树 */
    private buildFolderNodes(collection: SiteCollectionKey): ArticleFolderNode[] {
        const scoped = this.folders.filter((folder) => folder.collection === collection);
        const byParent = new Map<string | null, ArticleFolder[]>();
        for (const folder of scoped) {
            const key = folder.parentId ?? null;
            const list = byParent.get(key) || [];
            list.push(folder);
            byParent.set(key, list);
        }

        const countIn = (folderPath: string): number => {
            if (collection === "posts") {
                return this.posts.filter(
                    (post) => post.status !== "recycle" && (post.folderPath || "") === folderPath,
                ).length;
            }
            return this.siteEntries.filter(
                (entry) => entry.collection === collection && entry.folderPath === folderPath,
            ).length;
        };

        const build = (parentId: string | null): ArticleFolderNode[] => {
            const list = (byParent.get(parentId) || []).slice().sort((a, b) => a.name.localeCompare(b.name));
            return list.map((folder) => {
                const children = build(folder.id);
                const selfCount = countIn(folder.path);
                const childCount = children.reduce((sum, child) => sum + child.count, 0);
                return { ...folder, children, selfCount, count: selfCount + childCount };
            });
        };

        return build(null);
    }

    /** 把文件夹树压平成带深度的选项列表 */
    private flattenFolderNodes(nodes: ArticleFolderNode[]): { folder: ArticleFolder; depth: number }[] {
        const flat: { folder: ArticleFolder; depth: number }[] = [];
        const walk = (list: ArticleFolderNode[], depth: number) => {
            for (const node of list) {
                const { children, count, selfCount, ...folder } = node;
                flat.push({ folder, depth });
                walk(children, depth + 1);
            }
        };
        walk(nodes, 0);
        return flat;
    }

    /** 用真实目录树重建 folders (集合维度, path 为真实目录路径) */
    private rebuildFoldersFromTree(tree: SiteDirectoryNode[]): void {
        const list: ArticleFolder[] = [];
        const walk = (node: SiteDirectoryNode) => {
            if (node.type === "folder") {
                const parentPath = node.folderPath.includes("/")
                    ? node.folderPath.slice(0, node.folderPath.lastIndexOf("/"))
                    : "";
                list.push({
                    id: `${node.collection}:${node.folderPath}`,
                    name: node.name,
                    path: node.folderPath,
                    parentId: parentPath ? `${node.collection}:${parentPath}` : null,
                    collection: node.collection,
                });
            }
            for (const child of node.children || []) walk(child);
        };
        for (const root of tree) {
            for (const child of root.children || []) walk(child);
        }
        this.folders = list;
    }

    // 正在编辑的文章对象
    currentEditingPost = $derived.by(() => {
        if (!this.editingPostId) return null;
        return this.posts.find((p) => p.id === this.editingPostId) || null;
    });

    // 辅助映射
    categoriesMap = $derived.by(() => {
        const map = new Map<string, string>();
        for (const cat of this.categories) {
            map.set(cat.id, cat.name);
        }
        return map;
    });

    tagsMap = $derived.by(() => {
        const map = new Map<string, string>();
        for (const tag of this.tags) {
            map.set(tag.id, tag.name);
        }
        return map;
    });

    constructor() {
        this.loadFromStorage();
        this.syncFromBackendApi();
        void this.ensureSiteIndex();
    }

    private loadFromStorage() {
        // 文章/分类/标签/媒体一律从后端获取, 本地只保留站点设置等 UI 偏好。
        // 后端不可达时保持为空 (不显示任何本地种子内容)。
        if (typeof window === "undefined") {
            this.settings = { ...DEFAULT_SETTINGS };
            this.logs = [...INITIAL_LOGS];
            return;
        }

        try {
            const raw = localStorage.getItem(BLOG_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.settings) this.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
            }

            const rawLogs = localStorage.getItem(BLOG_LOGS_STORAGE_KEY);
            if (rawLogs) {
                const parsedLogs = JSON.parse(rawLogs);
                this.logs = Array.isArray(parsedLogs) ? parsedLogs : [];
            }

            localStorage.setItem("blog_site_settings", JSON.stringify(this.settings));
        } catch {
            // 忽略本地存储异常
        }
    }

    /**
     * 从后端同步业务数据 (分类 / 标签 / 媒体 / 设置 / 统计 / 日志)。
     * 文章由内容目录树 (ensureSiteIndex) 提供; 后端不可达时全部保持为空。
     */
    async syncFromBackendApi() {
        if (typeof window === "undefined") return;

        const [categories, tags, attachments, settings, stats, remoteLogs] = await Promise.all([
            categoriesApi.list().catch(() => null),
            tagsApi.list().catch(() => null),
            attachmentsApi.list().catch(() => null),
            settingsApi.get().catch(() => null),
            statsApi.get().catch(() => null),
            logsApi.list().catch(() => null),
        ]);

        this.categories = categories ?? [];
        this.tags = tags ?? [];
        this.attachments = (attachments ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            url: item.url,
            size: item.size,
            type: item.type,
            uploadTime: item.uploadedAt || new Date().toISOString(),
            uploaderId: "admin",
        }));

        if (settings) {
            this.settings = { ...this.settings, ...settings };
            if (typeof window !== "undefined") {
                localStorage.setItem("blog_site_settings", JSON.stringify(this.settings));
            }
        }
        if (stats && stats.throughput) this.throughput = stats.throughput;
        this.logs = remoteLogs ?? [];

        this.saveToStorage();
    }

    private saveToStorage() {
        if (typeof window === "undefined") return;
        try {
            // 只持久化站点设置; 文章/分类/标签/媒体均由后端持有, 不做本地缓存。
            localStorage.setItem(BLOG_STORAGE_KEY, JSON.stringify({ settings: this.settings }));
        } catch {
            // 忽略存储异常
        }
    }

    private saveLogsToStorage() {
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(BLOG_LOGS_STORAGE_KEY, JSON.stringify(this.logs));
        } catch {
            // 忽略
        }
    }

    // 视图导航控制
    setActiveTab(tab: ConsoleTab) {
        this.activeTab = tab;
    }

    startEditing(postId: string | null = null, folderPath?: string) {
        this.editingPostId = postId;
        if (postId) {
            const post = this.posts.find((p) => p.id === postId);
            this.composerFolderPath = post ? post.folderPath || "" : "";
        } else if (folderPath !== undefined) {
            this.composerFolderPath = folderPath;
        }
        this.activeTab = "editor";
    }

    // 审计日志管理
    async recordLog(action: string, detail: string, level: "info" | "success" | "warn" | "error" = "info", operator = "admin") {
        const newLog: AuditLog = {
            id: `log-${Date.now()}`,
            action,
            detail,
            level,
            operator,
            ip: "127.0.0.1",
            timestamp: new Date().toISOString(),
        };

        this.logs = [newLog, ...this.logs.slice(0, 99)];
        this.saveLogsToStorage();

        try {
            await logsApi.record({ action, detail, level, operator });
        } catch {
            // 降级本地
        }
    }

    clearLogs() {
        this.logs = [];
        this.saveLogsToStorage();
    }

    // 文章增删改查
    createPost(postData: Partial<Post>, authorId = "u-admin", authorName = "Halo 管理员"): Post {
        const content = postData.content || "";
        const wordCount = countWords(content);
        const readingTime = getReadingTime(content);
        const now = new Date().toISOString();

        const newPost: Post = {
            id: `post-${Date.now()}`,
            title: postData.title || "未命名新文章",
            slug: postData.slug || `post-${Date.now()}`,
            content,
            summary: postData.summary || content.slice(0, 120),
            excerpt: postData.summary || content.slice(0, 120),
            cover: postData.cover || "",
            status: postData.status || "draft",
            visibility: postData.visibility || "public",
            pinned: postData.pinned || false,
            allowComment: postData.allowComment ?? true,
            categories: postData.categories || [],
            tags: postData.tags || [],
            authorId,
            authorName,
            views: 0,
            wordCount,
            readingTime,
            createdAt: now,
            updatedAt: now,
            folderPath: postData.folderPath ?? this.composerFolderPath ?? "",
            contentFormat: postData.contentFormat || "markdown",
            contentId: postData.contentId,
        };

        this.posts = [newPost, ...this.posts];
        this.recalculateCounts();
        this.saveToStorage();
        this.recordLog("创建文章", `创建文章《${newPost.title}》(${newPost.status === 'published' ? '公开发布' : '存为草稿'})`, "success", authorName);
        return newPost;
    }

    updatePost(id: string, updates: Partial<Post>) {
        const now = new Date().toISOString();
        let targetTitle = "";
        this.posts = this.posts.map((post) => {
            if (post.id !== id) return post;
            const content = updates.content !== undefined ? updates.content : post.content;
            const wordCount = countWords(content);
            const readingTime = getReadingTime(content);
            targetTitle = updates.title || post.title;

            return {
                ...post,
                ...updates,
                wordCount,
                readingTime,
                updatedAt: now,
            };
        });
        this.recalculateCounts();
        this.saveToStorage();
        this.recordLog("更新文章", `更新文章《${targetTitle || id}》内容或元数据`, "info");
    }

    moveToRecycle(id: string) {
        this.updatePost(id, { status: "recycle" });
        this.recordLog("移至回收站", `文章 ID: ${id} 已移入回收站`, "warn");
    }

    restoreFromRecycle(id: string) {
        this.updatePost(id, { status: "draft" });
        this.recordLog("还原文章", `文章 ID: ${id} 从回收站恢复为草稿`, "info");
    }

    deletePostPermanently(id: string) {
        const post = this.posts.find((p) => p.id === id);
        this.posts = this.posts.filter((p) => p.id !== id);
        if (this.editingPostId === id) {
            this.editingPostId = null;
        }
        this.recalculateCounts();
        this.saveToStorage();
        this.recordLog("彻底删除文章", `彻底删除文章《${post?.title || id}》`, "warn");
    }

    publishPost(id: string) {
        this.updatePost(id, { status: "published" });
        this.recordLog("公开发布文章", `文章 ID: ${id} 状态变更为已发布`, "success");
    }

    unpublishPost(id: string) {
        this.updatePost(id, { status: "draft" });
        this.recordLog("下架文章", `文章 ID: ${id} 状态变更为草稿`, "info");
    }

    togglePin(id: string) {
        const post = this.posts.find((p) => p.id === id);
        if (post) {
            this.updatePost(id, { pinned: !post.pinned });
            this.recordLog("切换文章置顶", `文章《${post.title}》置顶状态设为 ${!post.pinned}`, "info");
        }
    }

    // 分类管理
    createCategory(data: Partial<Category>): Category {
        const newCat: Category = {
            id: `cat-${Date.now()}`,
            name: data.name || "新分类",
            slug: data.slug || `cat-${Date.now()}`,
            description: data.description || "",
            color: data.color || "#3b82f6",
            priority: data.priority || this.categories.length + 1,
            postCount: 0,
            createdAt: new Date().toISOString(),
        };
        this.categories = [...this.categories, newCat];
        this.saveToStorage();
        this.recordLog("新增分类", `新建文章分类「${newCat.name}」(${newCat.slug})`, "success");
        categoriesApi.create({ name: newCat.name, slug: newCat.slug, description: newCat.description, color: newCat.color }).catch(() => {});
        return newCat;
    }

    updateCategory(id: string, data: Partial<Category>) {
        this.categories = this.categories.map((c) => (c.id === id ? { ...c, ...data } : c));
        this.saveToStorage();
        this.recordLog("更新分类", `更新分类 ID: ${id}`, "info");
        categoriesApi.update(id, data).catch(() => {});
    }

    deleteCategory(id: string) {
        const cat = this.categories.find((c) => c.id === id);
        this.categories = this.categories.filter((c) => c.id !== id);
        // 解除文章的该分类关联
        this.posts = this.posts.map((p) => ({
            ...p,
            categories: p.categories.filter((cId) => cId !== id),
        }));
        this.saveToStorage();
        this.recordLog("删除分类", `删除分类「${cat?.name || id}」并解绑文章关联`, "warn");
        categoriesApi.delete(id).catch(() => {});
    }

    // 标签管理
    createTag(data: Partial<Tag>): Tag {
        const newTag: Tag = {
            id: `tag-${Date.now()}`,
            name: data.name || "新标签",
            slug: data.slug || `tag-${Date.now()}`,
            color: data.color || "#6366f1",
            postCount: 0,
        };
        this.tags = [...this.tags, newTag];
        this.saveToStorage();
        this.recordLog("新增标签", `新建标签「${newTag.name}」`, "success");
        tagsApi.create({ name: newTag.name, slug: newTag.slug, color: newTag.color }).catch(() => {});
        return newTag;
    }

    updateTag(id: string, data: Partial<Tag>) {
        this.tags = this.tags.map((t) => (t.id === id ? { ...t, ...data } : t));
        this.saveToStorage();
        this.recordLog("更新标签", `更新标签 ID: ${id}`, "info");
        tagsApi.update(id, data).catch(() => {});
    }

    deleteTag(id: string) {
        const tag = this.tags.find((t) => t.id === id);
        this.tags = this.tags.filter((t) => t.id !== id);
        this.posts = this.posts.map((p) => ({
            ...p,
            tags: p.tags.filter((tId) => tId !== id),
        }));
        this.saveToStorage();
        this.recordLog("删除标签", `删除标签「${tag?.name || id}」`, "warn");
        tagsApi.delete(id).catch(() => {});
    }

    // 附件管理
    async uploadAttachmentFile(file: File): Promise<Attachment> {
        try {
            const uploaded = await attachmentsApi.uploadFile(file);
            const newAtt: Attachment = {
                id: uploaded.id || `att-${Date.now()}`,
                name: uploaded.name,
                url: uploaded.url,
                size: uploaded.size,
                type: uploaded.type,
                uploadTime: uploaded.uploadedAt || new Date().toISOString(),
                uploaderId: "admin",
            };
            this.attachments = [newAtt, ...this.attachments.filter(a => a.id !== newAtt.id)];
            this.saveToStorage();
            this.recordLog("上传媒体文件", `成功上传素材「${newAtt.name}」`, "success");
            return newAtt;
        } catch (err: any) {
            this.recordLog("上传媒体文件失败", err?.message || "未知错误", "error");
            throw err;
        }
    }

    addAttachment(data: { name: string; url: string; size: number; type: string; uploaderId: string }): Attachment {
        const newAtt: Attachment = {
            id: `att-${Date.now()}`,
            name: data.name,
            url: data.url,
            size: data.size,
            type: data.type,
            uploadTime: new Date().toISOString(),
            uploaderId: data.uploaderId,
        };
        this.attachments = [newAtt, ...this.attachments];
        this.saveToStorage();
        this.recordLog("新增媒体附件", `录入素材「${newAtt.name}」`, "info");
        attachmentsApi.upload(data).catch(() => {});
        return newAtt;
    }

    deleteAttachment(id: string) {
        const att = this.attachments.find((a) => a.id === id);
        this.attachments = this.attachments.filter((a) => a.id !== id);
        this.saveToStorage();
        this.recordLog("删除媒体附件", `删除附件文件「${att?.name || id}」`, "warn");
        attachmentsApi.delete(id).catch(() => {});
    }

    // 内容集合的文件夹与条目管理
    // 所有 path 均为「集合根目录相对路径」, 与 src/content/<collection> 下的真实目录一致

    /** 在本地镜像中插入文件夹 (不落盘, 不记日志) */
    private insertLocalFolder(collection: SiteCollectionKey, name: string, parentPath: string): ArticleFolder {
        const trimmed = (name || "").trim();
        const parentId = parentPath ? `${collection}:${parentPath}` : null;
        const siblings = this.folders.filter(
            (folder) => folder.collection === collection && (folder.parentId ?? null) === parentId,
        );
        let finalName = trimmed;
        let suffix = 2;
        while (siblings.some((folder) => folder.name === finalName)) {
            finalName = `${trimmed}-${suffix++}`;
        }
        const path = parentPath ? `${parentPath}/${finalName}` : finalName;
        const folder: ArticleFolder = {
            id: `${collection}:${path}`,
            name: finalName,
            path,
            parentId,
            collection,
            createdAt: new Date().toISOString(),
        };
        this.folders = [...this.folders, folder];
        return folder;
    }

    /** 本地镜像中重写某个文件夹子树的路径前缀 */
    private remapLocalFolderPaths(collection: SiteCollectionKey, fromPath: string, toPath: string): void {
        const mapPath = (value: string): string =>
            value === fromPath || value.startsWith(fromPath + "/")
                ? toPath + value.slice(fromPath.length)
                : value;

        this.folders = this.folders
            .filter((folder) => folder.collection === collection)
            .map((folder) => {
                const nextPath = mapPath(folder.path);
                const parentPath = nextPath.includes("/")
                    ? nextPath.slice(0, nextPath.lastIndexOf("/"))
                    : "";
                return {
                    ...folder,
                    path: nextPath,
                    id: `${collection}:${nextPath}`,
                    parentId: parentPath ? `${collection}:${parentPath}` : null,
                };
            })
            .concat(this.folders.filter((folder) => folder.collection !== collection));

        if (collection === "posts") {
            this.posts = this.posts.map((post) =>
                post.folderPath ? { ...post, folderPath: mapPath(post.folderPath) } : post,
            );
        }
    }

    /** 新建文件夹 (可写时真实建目录, 否则仅写本地镜像) */
    async createFolder(input: {
        name: string;
        parentPath?: string;
        collection?: SiteCollectionKey;
    }): Promise<{ ok: boolean; folder?: ArticleFolder; error?: string }> {
        const collection = input.collection || this.selectedCollection;
        const parentPath = (input.parentPath || "").replace(/^\/+|\/+$/g, "");
        const name = (input.name || "").trim();
        if (!name) return { ok: false, error: "文件夹名称不能为空" };
        const path = parentPath ? `${parentPath}/${name}` : name;

        if (this.contentWritable) {
            const result = await createFolderApi(collection, parentPath, name);
            if (!result.ok) return { ok: false, error: result.error };
            await this.refreshSiteTree();
            this.recordLog("新建文件夹", `在 ${collection} 下创建文件夹「${path}」`, "success");
            return { ok: true, folder: this.findFolder(collection, path) || undefined };
        }

        const folder = this.insertLocalFolder(collection, name, parentPath);
        this.saveToStorage();
        this.recordLog("新建文件夹", `创建本地文件夹「${collection}/${path}」(未写回仓库)`, "info");
        return { ok: true, folder };
    }

    /** 重命名文件夹 */
    async renameFolder(
        collection: SiteCollectionKey,
        fromPath: string,
        name: string,
    ): Promise<{ ok: boolean; path?: string; error?: string }> {
        const next = (name || "").trim();
        if (!next) return { ok: false, error: "文件夹名称不能为空" };
        const parentPath = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
        const toPath = parentPath ? `${parentPath}/${next}` : next;
        if (toPath === fromPath) return { ok: true, path: fromPath };

        if (this.contentWritable) {
            const result = await renameFolderApi(collection, fromPath, toPath);
            if (!result.ok) return { ok: false, error: result.error };
            await this.refreshSiteTree();
            this.recordLog("重命名文件夹", `文件夹「${fromPath}」重命名为「${toPath}」`, "info");
            return { ok: true, path: toPath };
        }

        if (this.folders.some((folder) => folder.collection === collection && folder.path === toPath)) {
            return { ok: false, error: "同级已存在同名文件夹" };
        }
        this.remapLocalFolderPaths(collection, fromPath, toPath);
        this.saveToStorage();
        this.recordLog("重命名文件夹", `本地文件夹「${fromPath}」重命名为「${toPath}」(未写回仓库)`, "info");
        return { ok: true, path: toPath };
    }

    /** 移动文件夹到新的上级目录 */
    async moveFolder(
        collection: SiteCollectionKey,
        fromPath: string,
        toParentPath: string,
    ): Promise<{ ok: boolean; path?: string; error?: string }> {
        const parent = (toParentPath || "").replace(/^\/+|\/+$/g, "");
        if (parent === fromPath || parent.startsWith(fromPath + "/")) {
            return { ok: false, error: "不能移动到自身或子文件夹中" };
        }
        const segment = fromPath.split("/").pop() || fromPath;
        const toPath = parent ? `${parent}/${segment}` : segment;
        if (toPath === fromPath) return { ok: true, path: fromPath };

        if (this.contentWritable) {
            const result = await renameFolderApi(collection, fromPath, toPath);
            if (!result.ok) return { ok: false, error: result.error };
            await this.refreshSiteTree();
            this.recordLog("移动文件夹", `文件夹「${fromPath}」移动到「${toPath}」`, "info");
            return { ok: true, path: toPath };
        }

        this.remapLocalFolderPaths(collection, fromPath, toPath);
        this.saveToStorage();
        this.recordLog("移动文件夹", `本地文件夹「${fromPath}」移动到「${toPath}」(未写回仓库)`, "info");
        return { ok: true, path: toPath };
    }

    /** 复制文件夹 (含子文件夹与其中的条目) */
    async copyFolder(
        collection: SiteCollectionKey,
        fromPath: string,
        name?: string,
    ): Promise<{ ok: boolean; path?: string; error?: string }> {
        const source = this.findFolder(collection, fromPath);
        if (!source) return { ok: false, error: "源文件夹不存在" };
        const baseName = (name || "").trim() || `${source.name}-copy`;
        const parentPath = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
        const targetRoot = parentPath ? `${parentPath}/${baseName}` : baseName;

        const created = await this.createFolder({ name: baseName, parentPath, collection });
        if (!created.ok) return { ok: false, error: created.error };

        const subFolders = this.folders.filter(
            (folder) => folder.collection === collection && folder.path.startsWith(fromPath + "/"),
        );
        for (const folder of subFolders) {
            const relative = folder.path.slice(fromPath.length + 1);
            const targetParent = `${targetRoot}/${relative}`.split("/").slice(0, -1).join("/");
            await this.createFolder({ name: folder.name, parentPath: targetParent, collection });
        }

        if (this.contentWritable) {
            const sourceEntries = this.siteEntries.filter(
                (entry) =>
                    entry.collection === collection &&
                    (entry.folderPath === fromPath || entry.folderPath.startsWith(fromPath + "/")),
            );
            for (const entry of sourceEntries) {
                const relative = entry.folderPath === fromPath ? "" : entry.folderPath.slice(fromPath.length + 1);
                const targetFolder = relative ? `${targetRoot}/${relative}` : targetRoot;
                const targetPath = `${targetFolder}/${entry.relPath.split("/").pop()}`;
                const loaded = await this.loadEntryContent(collection, entry.relPath);
                if (!loaded.ok) continue;
                await putEntry(
                    collection,
                    targetPath,
                    loaded.data ? { data: loaded.data } : { content: loaded.content || "" },
                    true,
                );
            }
            await this.refreshSiteTree();
        }

        this.recordLog("复制文件夹", `复制文件夹「${fromPath}」为「${targetRoot}」`, "success");
        return { ok: true, path: targetRoot };
    }

    /** 删除文件夹 (keep-posts: 内容上移一级; delete-posts: 连同内容删除) */
    async deleteFolder(
        collection: SiteCollectionKey,
        path: string,
        mode: "keep-posts" | "delete-posts" = "keep-posts",
    ): Promise<{ ok: boolean; error?: string }> {
        if (this.contentWritable) {
            const result = await deleteFolderApi(collection, path, mode === "keep-posts");
            if (!result.ok) return { ok: false, error: result.error };
            await this.refreshSiteTree();
        } else {
            const doomed = this.folders.filter(
                (folder) =>
                    folder.collection === collection &&
                    (folder.path === path || folder.path.startsWith(path + "/")),
            );
            const doomedPaths = doomed.map((folder) => folder.path);
            if (collection === "posts") {
                const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
                if (mode === "delete-posts") {
                    this.posts = this.posts.filter((post) => !doomedPaths.includes(post.folderPath || ""));
                } else {
                    this.posts = this.posts.map((post) =>
                        doomedPaths.includes(post.folderPath || "") ? { ...post, folderPath: parentPath } : post,
                    );
                }
            }
            this.folders = this.folders.filter((folder) => !doomed.includes(folder));
            this.saveToStorage();
        }

        if (
            this.selectedFolderPath !== null &&
            this.selectedFolderPath !== RECYCLE_PATH &&
            (this.selectedFolderPath === path || this.selectedFolderPath.startsWith(path + "/"))
        ) {
            this.selectedFolderPath = null;
        }
        this.recalculateCounts();
        this.recordLog(
            "删除文件夹",
            `删除文件夹「${collection}/${path}」${mode === "delete-posts" ? "，其中内容一并删除" : "，其中内容上移一级"}`,
            "warn",
        );
        return { ok: true };
    }

    /** 由文章记录推导其在 src/content/posts 下的相对路径 */
    private postRelPath(post: Post): string | null {
        if (!post.filePath) return null;
        const match = post.filePath.replace(/\\/g, "/").match(/content\/posts\/(.+)$/);
        return match ? match[1] : null;
    }

    private formatFromEntry(entry: SiteIndexEntry): ContentFormat {
        if (entry.format === "html" || entry.format === "mdx") return entry.format;
        return "markdown";
    }

    /** 用站点条目刷新一条既有文章记录 */
    private applySiteEntryToPost(post: Post, entry: SiteIndexEntry): Post {
        const meta = (entry.meta || {}) as Record<string, unknown>;
        return {
            ...post,
            // 真实文件文章的正文以仓库文件为唯一来源, 打开编辑器时按需拉取。
            // 这里必须清空内存里的正文, 否则 mock 数据里截断的摘要会被当成正文显示,
            // 一旦保存就会把真实文件覆盖成这段截断文本。
            content: "",
            contentId: entry.id,
            folderPath: entry.folderPath,
            contentFormat: this.formatFromEntry(entry),
            filePath: entry.filePath,
            status: post.status === "recycle" ? "recycle" : meta.draft === true ? "draft" : "published",
            pinned: meta.pinned === true,
            title: post.title || entry.name,
        };
    }

    /** 由站点真实条目创建一条控制台文章记录 (正文在打开编辑器时按需拉取) */
    private createPostFromSiteEntry(entry: SiteIndexEntry): Post {
        const meta = (entry.meta || {}) as Record<string, unknown>;
        const category = meta.category;
        const createdAt =
            (typeof meta.published === "string" && meta.published) ||
            this.siteIndex?.generatedAt ||
            new Date().toISOString();
        return {
            id: `site-posts-${entry.relPath}`,
            title: (typeof meta.title === "string" && meta.title) || entry.name,
            slug: entry.id.split("/").pop() || entry.id,
            content: "",
            summary: (typeof meta.description === "string" && meta.description) || "",
            excerpt: (typeof meta.description === "string" && meta.description) || "",
            cover: (typeof meta.cover === "string" && meta.cover) || "",
            status: meta.draft === true ? "draft" : "published",
            visibility: "public",
            pinned: meta.pinned === true,
            allowComment: true,
            categories: Array.isArray(category) ? (category as string[]) : category ? [String(category)] : [],
            tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
            authorId: "u-admin",
            authorName: "Halo 管理员",
            views: 0,
            wordCount: 0,
            readingTime: 1,
            createdAt,
            updatedAt: createdAt,
            folderPath: entry.folderPath,
            contentFormat: this.formatFromEntry(entry),
            contentId: entry.id,
            filePath: entry.filePath,
        };
    }

    /**
     * 把控制台文章与站点真实内容条目对齐:
     *  - 每篇真实文章都保证存在一条控制台记录 (不再是 mock 镜像)
     *  - 回收站记录与尚未落盘的本地稿件予以保留
     */
    private reconcilePostsWithSiteIndex(entries: SiteIndexEntry[]): number {
        const postEntries = entries.filter((entry) => entry.collection === "posts");
        if (postEntries.length === 0) return 0;

        const normalize = (value: string) => (value || "").trim().toLowerCase().replace(/[\s/]+/g, "");
        const pool = [...this.posts];
        const next: Post[] = [];
        let linked = 0;

        for (const entry of postEntries) {
            const lastSegment = entry.id.split("/").pop() || "";
            const index = pool.findIndex(
                (post) =>
                    (post.contentId && normalize(post.contentId) === normalize(entry.id)) ||
                    normalize(post.slug) === normalize(entry.id) ||
                    normalize(post.slug) === normalize(lastSegment) ||
                    normalize(post.title) === normalize(entry.name),
            );
            if (index >= 0) {
                const post = pool.splice(index, 1)[0];
                next.push(this.applySiteEntryToPost(post, entry));
                linked += 1;
            } else {
                next.push(this.createPostFromSiteEntry(entry));
            }
        }

        const kept = pool.filter(
            (post) => post.status === "recycle" || (!post.contentId && !SEED_POST_IDS.has(post.id)),
        );
        this.posts = [...next, ...kept];
        this.recalculateCounts();
        this.saveToStorage();
        return linked;
    }

    /** 移动单篇文章到指定文件夹路径 (空串 = 集合根目录) */
    async movePost(postId: string, folderPath: string): Promise<boolean> {
        const post = this.posts.find((item) => item.id === postId);
        if (!post) return false;
        const target = (folderPath || "").replace(/^\/+|\/+$/g, "");
        if ((post.folderPath || "") === target) return false;

        const relPath = this.postRelPath(post);
        if (this.contentWritable && relPath) {
            const filename = relPath.split("/").pop()!;
            const to = target ? `${target}/${filename}` : filename;
            const result = await moveEntryApi("posts", relPath, to);
            if (!result.ok) {
                this.recordLog("移动文章失败", result.error, "error");
                return false;
            }
            await this.refreshSiteTree();
        } else {
            this.posts = this.posts.map((item) => (item.id === postId ? { ...item, folderPath: target } : item));
            this.saveToStorage();
        }

        this.recordLog("移动文章", `文章《${post.title}》移动到「${target || "集合根目录"}」`, "info");
        return true;
    }

    /** 批量移动文章 */
    async movePosts(postIds: string[], folderPath: string): Promise<number> {
        let moved = 0;
        for (const id of postIds) {
            if (await this.movePost(id, folderPath)) moved += 1;
        }
        if (moved > 0) {
            this.recordLog("批量移动文章", `${moved} 篇文章移动到「${folderPath || "集合根目录"}」`, "info");
        }
        return moved;
    }

    /* ------------------------------------------------------------------ */
    /* 集合条目读写                                                        */
    /* ------------------------------------------------------------------ */

    /** 读取条目原文与解析数据 (可写环境读取真实文件) */
    async loadEntryContent(
        collection: SiteCollectionKey,
        relPath: string,
    ): Promise<{ ok: boolean; content?: string; data?: Record<string, unknown> | null; error?: string }> {
        const result = await fetchEntry(collection, relPath);
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, content: result.data.content, data: result.data.data };
    }

    /** 写入条目 (文章写正文, JSON 集合写校验后的数据) */
    async saveEntry(
        collection: SiteCollectionKey,
        relPath: string,
        payload: { content?: string; data?: Record<string, unknown>; frontmatterKeys?: string[] },
    ): Promise<{ ok: boolean; created?: boolean; error?: string }> {
        if (!this.contentWritable) {
            return { ok: false, error: "后端未连接, 无法写入内容" };
        }
        const result = await putEntry(collection, relPath, payload, true);
        if (!result.ok) return { ok: false, error: result.error };
        await this.refreshSiteTree();
        this.recordLog(
            "写入内容文件",
            `已写入 src/content/${collection}/${relPath}`,
            "success",
        );
        return { ok: true, created: result.data.created };
    }

    /** 删除条目 */
    async deleteEntry(
        collection: SiteCollectionKey,
        relPath: string,
    ): Promise<{ ok: boolean; error?: string }> {
        if (!this.contentWritable) {
            return { ok: false, error: "后端未连接, 无法删除内容" };
        }
        const result = await deleteEntryApi(collection, relPath);
        if (!result.ok) return { ok: false, error: result.error };
        await this.refreshSiteTree();
        this.recordLog("删除内容条目", `已删除 src/content/${collection}/${relPath}`, "warn");
        return { ok: true };
    }

    /** 移动条目到新的文件夹 */
    async moveEntry(
        collection: SiteCollectionKey,
        relPath: string,
        targetFolder: string,
    ): Promise<{ ok: boolean; path?: string; error?: string }> {
        const target = (targetFolder || "").replace(/^\/+|\/+$/g, "");
        const filename = relPath.split("/").pop()!;
        const to = target ? `${target}/${filename}` : filename;
        if (to === relPath) return { ok: true, path: to };
        if (!this.contentWritable) {
            return { ok: false, error: "后端未连接, 无法移动内容" };
        }
        const result = await moveEntryApi(collection, relPath, to);
        if (!result.ok) return { ok: false, error: result.error };
        await this.refreshSiteTree();
        this.recordLog("移动内容条目", `${collection}: ${relPath} -> ${to}`, "info");
        return { ok: true, path: to };
    }

    /** 新建 JSON 集合条目 */
    async createEntry(
        collection: SiteCollectionKey,
        folderPath: string,
        data: Record<string, unknown>,
    ): Promise<{ ok: boolean; relPath?: string; error?: string }> {
        const schema = getCollectionSchema(collection);
        if (!schema) return { ok: false, error: "该集合不支持在此新建条目" };
        const name = String(data[schema.nameField] || "").trim() || `${collection}-${Date.now()}`;
        const folder = (folderPath || "").replace(/^\/+|\/+$/g, "");
        const filename = `${slugifyEntryName(name)}.json`;
        const relPath = folder ? `${folder}/${filename}` : filename;
        const result = await this.saveEntry(collection, relPath, { data });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, relPath };
    }

    /** 生成某个集合的空白条目模板 */
    entryTemplate(collection: SiteCollectionKey): Record<string, unknown> | null {
        return isJsonCollectionKey(collection) ? createDefaultEntry(collection) : null;
    }

    /* ------------------------------------------------------------------ */
    /* 站点目录同步                                                        */
    /* ------------------------------------------------------------------ */

    /** 由真实目录树推导集合元信息 */
    private updateCollectionsFromTree(tree: SiteDirectoryNode[]): void {
        this.siteCollections = SITE_COLLECTIONS.map((def) => {
            const root = tree.find((node) => node.collection === def.key);
            const folderPaths: string[] = [];
            const collect = (node: SiteDirectoryNode) => {
                if (node.type === "folder") folderPaths.push(node.folderPath);
                for (const child of node.children || []) collect(child);
            };
            for (const child of root?.children || []) collect(child);
            return {
                key: def.key,
                label: root?.label || def.fallbackLabel,
                root: def.root,
                relRoot: def.relRoot,
                listUrl: def.listUrl,
                entryKind: def.entryKind,
                extensions: def.extensions,
                entryCount: root?.count || 0,
                folderPaths: folderPaths.sort(),
            };
        });
    }

    /** 由真实目录树重建扁平条目列表 */
    private rebuildEntriesFromTree(tree: SiteDirectoryNode[]): void {
        const entries: SiteIndexEntry[] = [];
        const walk = (node: SiteDirectoryNode) => {
            if (node.type === "entry") {
                entries.push({
                    collection: node.collection,
                    id: node.entryId || node.name,
                    name: node.name,
                    folderPath: node.folderPath,
                    relPath: node.path.slice(node.collection.length + 1),
                    filePath: node.file || "",
                    url: node.url || "",
                    format: node.format || "json",
                    meta: node.meta || {},
                });
            }
            for (const child of node.children || []) walk(child);
        };
        for (const root of tree) {
            for (const child of root.children || []) walk(child);
        }
        this.siteEntries = entries;
    }

    /** 应用一棵真实目录树 (文件夹/条目/集合元信息 + 文章对齐) */
    private applyTree(tree: SiteDirectoryNode[]): void {
        this.siteTree = tree;
        this.rebuildFoldersFromTree(tree);
        this.rebuildEntriesFromTree(tree);
        this.updateCollectionsFromTree(tree);
        this.reconcilePostsWithSiteIndex(this.siteEntries);
    }

    /** 重新拉取索引 (只读环境) */
    private async reloadIndex(): Promise<boolean> {
        const index = await loadContentIndex(true);
        if (!index) return false;
        this.siteIndex = index;
        this.siteTree = index.tree;
        this.siteCollections = index.collections;
        this.siteEntries = index.entries;
        this.rebuildFoldersFromTree(index.tree);
        this.reconcilePostsWithSiteIndex(index.entries);
        this.saveToStorage();
        return true;
    }

    /** 刷新站点目录树: 可写时读服务端实时树, 否则回退到构建期索引 */
    async refreshSiteTree(): Promise<boolean> {
        this.siteSyncing = true;
        try {
            if (this.contentWritable) {
                const result = await fetchContentTree();
                if (result.ok) {
                    this.applyTree(result.data.tree);
                    this.saveToStorage();
                    // 同步构建期索引, 仅用于前台真实路由解析 (树以实时文件系统为准)
                    const index = await loadContentIndex();
                    if (index) this.siteIndex = index;
                    return true;
                }
            }
            return await this.reloadIndex();
        } finally {
            this.siteSyncing = false;
        }
    }

    // 站点真实内容索引 (惰性加载, 用于文件夹种子与前台路由解析)

    siteIndex = $state<ContentIndex | null>(null);

    /** 解析文章在前台的真实 URL (带尾斜杠); 未匹配到站点条目返回 null */
    resolvePostUrl(post: Post): string | null {
        return resolvePostUrl(this.siteIndex, post);
    }

    /** 探测写回能力并同步站点目录 */
    async syncSiteDirectory(): Promise<{ folders: number; linked: number; writable: boolean }> {
        const capabilities = await fetchCapabilities();
        if (capabilities.ok) {
            this.contentWritable = capabilities.data.writable;
            this.contentWriteReason = capabilities.data.reason;
        } else {
            this.contentWritable = false;
            this.contentWriteReason = "后端未连接, 内容服务不可达";
        }

        const before = this.folders.length;
        const ok = await this.refreshSiteTree();
        markSiteIndexSynced();
        const linked = this.posts.filter((post) => !!post.contentId).length;
        return {
            folders: ok ? Math.max(0, this.folders.length - before) : 0,
            linked,
            writable: this.contentWritable,
        };
    }

    /** 首次进入控制台自动对齐一次 (失败不影响本地数据) */
    async ensureSiteIndex(): Promise<void> {
        const capabilities = await fetchCapabilities();
        if (capabilities.ok) {
            this.contentWritable = capabilities.data.writable;
            this.contentWriteReason = capabilities.data.reason;
        }

        // 可写环境直接读取真实文件系统的实时树 (含空文件夹), 保证与仓库目录完全一致
        if (this.contentWritable) {
            const ok = await this.refreshSiteTree();
            if (ok) {
                markSiteIndexSynced();
                return;
            }
        }

        if (hasSyncedSiteIndex()) {
            const index = await loadContentIndex();
            if (index) {
                this.siteIndex = index;
                this.siteTree = index.tree;
                this.siteCollections = index.collections;
                this.siteEntries = index.entries;
                this.rebuildFoldersFromTree(index.tree);
                this.reconcilePostsWithSiteIndex(index.entries);
                return;
            }
        }
        await this.syncSiteDirectory();
    }

    /** 切换当前浏览的内容集合 */
    selectCollection(collection: SiteCollectionKey): void {
        this.selectedCollection = collection;
        this.selectedFolderPath = null;
        if (collection !== "posts" && this.postStatusFilter === "recycle") {
            this.postStatusFilter = "all";
        }
    }

    // 系统设置
    updateSettings(data: Partial<SiteSettings>) {
        this.settings = { ...this.settings, ...data };
        this.saveToStorage();
        if (typeof window !== "undefined") {
            localStorage.setItem("blog_site_settings", JSON.stringify(this.settings));
            window.dispatchEvent(new CustomEvent("site-settings-changed", { detail: this.settings }));
        }
        this.recordLog("修改站点设置", "更新站点标题、Slogan或系统全局开关", "info");
        settingsApi.update(data).catch(() => {});
    }

    // 重新统计文章数
    private recalculateCounts() {
        const activePosts = this.posts.filter((p) => p.status !== "recycle");
        this.categories = this.categories.map((c) => ({
            ...c,
            postCount: activePosts.filter((p) => p.categories.includes(c.id)).length,
        }));
        this.tags = this.tags.map((t) => ({
            ...t,
            postCount: activePosts.filter((p) => p.tags.includes(t.id)).length,
        }));
    }

    // 从备份文件恢复全站数据
    restoreFromBackup(bundle: FullBackupBundle): boolean {
        try {
            if (Array.isArray(bundle.posts)) this.posts = bundle.posts;
            if (Array.isArray(bundle.categories)) this.categories = bundle.categories;
            if (Array.isArray(bundle.tags)) this.tags = bundle.tags;
            if (Array.isArray(bundle.attachments)) this.attachments = bundle.attachments;
            if (Array.isArray(bundle.folders)) {
                this.folders = bundle.folders.map((folder) => ({
                    ...folder,
                    collection: folder.collection || "posts",
                }));
            }
            if (bundle.settings) this.settings = { ...this.settings, ...bundle.settings };
            this.recalculateCounts();
            this.saveToStorage();
            this.recordLog("导入备份数据", `从备份包恢复成功，包含 ${bundle.posts?.length || 0} 篇文章`, "success");
            return true;
        } catch (e) {
            console.error("恢复备份失败", e);
            return false;
        }
    }

    // 重置恢复默认数据 (仅重置本地偏好; 后端内容不受影响)
    resetAllData() {
        this.posts = [];
        this.categories = [];
        this.tags = [];
        this.attachments = [];
        this.settings = { ...DEFAULT_SETTINGS };
        this.logs = [];
        this.folders = [];
        this.selectedFolderPath = null;
        this.composerFolderPath = "";
        this.saveToStorage();
        this.recordLog("重置系统数据", "已重置本地控制台偏好 (后端内容不受影响)", "warn");
    }
}

export const blogStore = new BlogStore();
