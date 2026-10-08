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
} from "./types";
import {
    DEFAULT_POSTS,
    DEFAULT_CATEGORIES,
    DEFAULT_TAGS,
    DEFAULT_ATTACHMENTS,
    DEFAULT_SETTINGS,
} from "./mockData";
import { countWords, getReadingTime } from "./markdown";
import { postsApi, categoriesApi, tagsApi, attachmentsApi, statsApi, logsApi, settingsApi } from "./api";

const BLOG_STORAGE_KEY = "twilight_halo_blog_v3";
const BLOG_LOGS_STORAGE_KEY = "twilight_halo_logs_v3";

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

    // 工作台视图状态
    activeTab = $state<ConsoleTab>("dashboard");
    editingPostId = $state<string | null>(null);

    // 筛选与检索状态
    postSearchKeyword = $state<string>("");
    postStatusFilter = $state<"all" | "published" | "draft" | "recycle">("all");
    postCategoryFilter = $state<string>("all");

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
    }

    private loadFromStorage() {
        if (typeof window === "undefined") {
            this.posts = [...DEFAULT_POSTS];
            this.categories = [...DEFAULT_CATEGORIES];
            this.tags = [...DEFAULT_TAGS];
            this.attachments = [...DEFAULT_ATTACHMENTS];
            this.settings = { ...DEFAULT_SETTINGS };
            this.logs = [...INITIAL_LOGS];
            return;
        }

        try {
            const raw = localStorage.getItem(BLOG_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.posts = Array.isArray(parsed.posts) && parsed.posts.length > 0 ? parsed.posts : [...DEFAULT_POSTS];
                this.categories = Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : [...DEFAULT_CATEGORIES];
                this.tags = Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags : [...DEFAULT_TAGS];
                this.attachments = Array.isArray(parsed.attachments) && parsed.attachments.length > 0 ? parsed.attachments : [...DEFAULT_ATTACHMENTS];
                this.settings = parsed.settings || { ...DEFAULT_SETTINGS };
            } else {
                this.resetAllData();
            }

            const rawLogs = localStorage.getItem(BLOG_LOGS_STORAGE_KEY);
            if (rawLogs) {
                const parsedLogs = JSON.parse(rawLogs);
                this.logs = Array.isArray(parsedLogs) && parsedLogs.length > 0 ? parsedLogs : [...INITIAL_LOGS];
            } else {
                this.logs = [...INITIAL_LOGS];
            }

            localStorage.setItem("blog_site_settings", JSON.stringify(this.settings));
        } catch {
            this.resetAllData();
        }
    }

    async syncFromBackendApi() {
        if (typeof window === "undefined") return;
        try {
            const [remotePosts, stats, remoteLogs] = await Promise.all([
                postsApi.list().catch(() => null),
                statsApi.get().catch(() => null),
                logsApi.list().catch(() => null),
            ]);

            if (remotePosts && remotePosts.length > 0) {
                this.posts = remotePosts.map((p) => ({
                    id: p.id,
                    title: p.title,
                    slug: p.slug,
                    content: p.content,
                    summary: p.excerpt || (p.content ? p.content.slice(0, 120) : ""),
                    cover: "",
                    status: (p.status || "published") as any,
                    visibility: "public",
                    pinned: !!p.pinned,
                    allowComment: true,
                    categories: p.categories || [],
                    tags: p.tags || [],
                    authorId: p.authorId || "admin",
                    authorName: p.author || "Halo 管理员",
                    views: p.views || 0,
                    wordCount: p.wordCount || 0,
                    readingTime: Math.ceil((p.wordCount || 0) / 300),
                    createdAt: p.createdAt,
                    updatedAt: p.updatedAt,
                }));
                this.recalculateCounts();
                this.saveToStorage();
            }

            if (stats && stats.throughput) {
                this.throughput = stats.throughput;
            }

            if (remoteLogs && Array.isArray(remoteLogs) && remoteLogs.length > 0) {
                this.logs = remoteLogs as AuditLog[];
                this.saveLogsToStorage();
            }
        } catch {
            // 离线或后端未启动时维持本地沙箱数据
        }
    }

    private saveToStorage() {
        if (typeof window === "undefined") return;
        try {
            const payload = {
                posts: this.posts,
                categories: this.categories,
                tags: this.tags,
                attachments: this.attachments,
                settings: this.settings,
            };
            localStorage.setItem(BLOG_STORAGE_KEY, JSON.stringify(payload));
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

    startEditing(postId: string | null = null) {
        this.editingPostId = postId;
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
        };

        this.posts = [newPost, ...this.posts];
        this.recalculateCounts();
        this.saveToStorage();
        this.recordLog("创建文章", `创建文章《${newPost.title}》(${newPost.status === 'published' ? '公开发布' : '存为草稿'})`, "success", authorName);
        postsApi.create({ title: newPost.title, content: newPost.content, slug: newPost.slug, status: newPost.status as any, categories: newPost.categories, tags: newPost.tags, pinned: newPost.pinned }).catch(() => {});
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
        postsApi.update(id, updates as any).catch(() => {});
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
        postsApi.delete(id).catch(() => {});
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

    // 重置恢复默认数据
    resetAllData() {
        this.posts = [...DEFAULT_POSTS];
        this.categories = [...DEFAULT_CATEGORIES];
        this.tags = [...DEFAULT_TAGS];
        this.attachments = [...DEFAULT_ATTACHMENTS];
        this.settings = { ...DEFAULT_SETTINGS };
        this.logs = [...INITIAL_LOGS];
        this.recalculateCounts();
        this.saveToStorage();
        this.saveLogsToStorage();
        this.recordLog("重置系统数据", "已重置并恢复初始示例数据", "warn");
    }
}

export const blogStore = new BlogStore();
