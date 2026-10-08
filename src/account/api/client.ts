/**
 * 前后端完全解耦的标准 REST API 客户端
 * 支持配置后端 BaseURL (如 PHP: http://127.0.0.1:8000/api 或 Java Web)
 * 具备双模自适应：后端在线时走标准 REST API，后端离线/未启动时透明降级至 LocalStorage 持久化存储引擎
 */

import type {
    ApiResponse,
    UserProfile,
    PostItem,
    CategoryItem,
    TagItem,
    AttachmentItem,
    DashboardStats,
    ThroughputBucket,
    ThroughputData,
    AuditLogItem,
    SiteSettingsItem
} from './types';

// 获取配置的基础 API 路径
export function getBaseUrl(): string {
    if (typeof window !== 'undefined') {
        const local = localStorage.getItem('halo_api_base');
        if (local) return local;
    }
    return 'http://127.0.0.1:8000/api';
}

export function setBaseUrl(url: string): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem('halo_api_base', url);
    }
}

// 探测后端连通性
export async function pingBackend(): Promise<{ online: boolean; latency: number; message: string }> {
    const start = performance.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`${getBaseUrl()}/stats`, {
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const latency = Math.round(performance.now() - start);
        if (res.ok) {
            return { online: true, latency, message: `连接正常 (${latency}ms)` };
        }
        return { online: false, latency, message: `响应异常 HTTP ${res.status}` };
    } catch {
        return { online: false, latency: 0, message: '后端未启动或不可达 (已切本地沙箱)' };
    }
}

// 默认内置文章种子数据
const INITIAL_POSTS: PostItem[] = [
    {
        id: 'post-1',
        title: 'Halo 2.0 风格管理控制台重构实践：解耦与沉浸式体验',
        slug: 'halo-2-console-refactor',
        content: '# Halo 2.0 风格管理控制台重构实践\n\n通过前后端完全解耦架构与 Svelte 5 响应式引擎，我们打造了高质感与高性能的博客工作台。',
        excerpt: '探索前后端分离、Svelte 5 响应式引擎与液态毛玻璃视觉在现代内容管理系统中的实践。',
        status: 'published',
        pinned: true,
        author: 'Halo 管理员',
        authorId: 'admin',
        categories: ['cat-1'],
        tags: ['tag-1', 'tag-2'],
        views: 1420,
        wordCount: 520,
        createdAt: '2026-04-01T10:00:00Z',
        updatedAt: '2026-04-02T14:20:00Z',
    },
    {
        id: 'post-2',
        title: '深入浅出 Svelte 5：Runes 响应式驱动的现代状态管理',
        slug: 'svelte-5-runes-guide',
        content: '# 深入浅出 Svelte 5\n\nRunes 带来更清晰的显式响应式语义，大幅提升了复杂组件状态的可预测性。',
        excerpt: '解读 $state, $derived, $effect 等全新 Runes 特性及其在工程架构中的最佳实践。',
        status: 'published',
        pinned: false,
        author: '签约专栏作家 Tom',
        authorId: 'author_tom',
        categories: ['cat-1', 'cat-2'],
        tags: ['tag-2', 'tag-3'],
        views: 880,
        wordCount: 430,
        createdAt: '2026-04-03T09:30:00Z',
        updatedAt: '2026-04-03T11:00:00Z',
    },
    {
        id: 'post-3',
        title: 'Astro 与 Twilight 毛玻璃视觉：打造高通透感现代博客',
        slug: 'astro-twilight-glass-design',
        content: '# Astro 与 Twilight 毛玻璃视觉\n\n结合 CSS 滤镜与折射高光打造通透自然的 Apple 质感界面。',
        excerpt: '深度解析 LiquidGlass 液态毛玻璃设计系统在 Astro 模板中的落地与多端适配技巧。',
        status: 'published',
        pinned: false,
        author: '签约专栏作家 Tom',
        authorId: 'author_tom',
        categories: ['cat-3'],
        tags: ['tag-4'],
        views: 650,
        wordCount: 380,
        createdAt: '2026-04-05T15:00:00Z',
        updatedAt: '2026-04-05T15:00:00Z',
    },
    {
        id: 'post-4',
        title: '下一代轻量化内容发布系统架构思考（草稿）',
        slug: 'next-gen-cms-architecture',
        content: '# 下一代轻量化内容发布系统架构思考\n\n解耦前后端，支持多端部署与静态化分发方案。',
        excerpt: '探讨静态站点生成（SSG）与动态管理后台的有机融合，提升安全与访问速度。',
        status: 'draft',
        pinned: false,
        author: '投稿人 Lucy',
        authorId: 'contrib_lucy',
        categories: ['cat-2'],
        tags: ['tag-5'],
        views: 0,
        wordCount: 160,
        createdAt: '2026-04-06T08:00:00Z',
        updatedAt: '2026-04-06T08:00:00Z',
    },
    {
        id: 'post-5',
        title: '测试 Halo 控制台重构效果',
        slug: 'test-console-feature',
        content: '# 测试控制台功能\n\n验证文章发布与实时统计指标更新。',
        excerpt: '快速测试文章保存与多分类标签关联。',
        status: 'published',
        pinned: false,
        author: 'Halo 管理员',
        authorId: 'admin',
        categories: ['cat-1'],
        tags: ['tag-1'],
        views: 12,
        wordCount: 39,
        createdAt: '2026-10-07T12:00:00Z',
        updatedAt: '2026-10-07T12:00:00Z',
    }
];

const INITIAL_CATEGORIES: CategoryItem[] = [
    { id: 'cat-1', name: '架构与工程', slug: 'architecture', description: '前后端全栈工程实践与性能优化', color: '#3b82f6', count: 3 },
    { id: 'cat-2', name: '前端生态', slug: 'frontend', description: 'Svelte, Astro, Vue 与现代化工具链', color: '#10b981', count: 2 },
    { id: 'cat-3', name: '设计与质感', slug: 'design', description: 'LiquidGlass 液态毛玻璃与界面美学', color: '#8b5cf6', count: 1 },
    { id: 'cat-4', name: '随笔日常', slug: 'daily', description: '开发者的日常随想与感悟记录', color: '#f59e0b', count: 0 },
];

const INITIAL_TAGS: TagItem[] = [
    { id: 'tag-1', name: 'Halo2', slug: 'halo2', color: '#3b82f6', count: 2 },
    { id: 'tag-2', name: 'Svelte5', slug: 'svelte5', color: '#ff3e00', count: 2 },
    { id: 'tag-3', name: 'Runes', slug: 'runes', color: '#10b981', count: 1 },
    { id: 'tag-4', name: '毛玻璃UI', slug: 'glassmorphism', color: '#8b5cf6', count: 1 },
    { id: 'tag-5', name: '静态博客', slug: 'ssg', color: '#ec4899', count: 1 },
];

const INITIAL_ATTACHMENTS: AttachmentItem[] = [
    { id: 'att-1', name: 'twilight-hero.webp', url: '/_astro/Twilight_Cover.CodURR07_Z1vOv5x.webp', size: 184320, type: 'image/webp', uploadedAt: '2026-04-01T12:00:00Z' },
    { id: 'att-2', name: 'architecture-flow.svg', url: '/icons/favicon.svg', size: 12400, type: 'image/svg+xml', uploadedAt: '2026-04-02T15:20:00Z' },
    { id: 'att-3', name: 'avatar-admin.png', url: '/logo.png', size: 45600, type: 'image/png', uploadedAt: '2026-04-03T08:00:00Z' }
];

const INITIAL_USERS: UserProfile[] = [
    {
        id: 'u-admin',
        username: 'admin',
        name: 'Halo 管理员',
        email: 'admin@halo.run',
        role: 'admin',
        avatar: '/logo.png',
        bio: '超级系统管理员，全权限管控中枢',
        status: 'active'
    },
    {
        id: 'u-tom',
        username: 'tom',
        name: '签约专栏作家 Tom',
        email: 'tom@mc00blog.local',
        role: 'author',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=tom',
        bio: '专注于前沿前端生态与交互动效。',
        status: 'active'
    }
];

const INITIAL_SETTINGS: SiteSettingsItem = {
    siteName: 'Twilight Blog',
    siteSubtitle: '现代化液态毛玻璃博客管理控制台',
    announcement: '控制台已顺利升级为 CPAMC 风格架构，全功能支持液态/毛玻璃双模式切换。',
    allowRegistration: false,
    allowComments: true,
    copyProtection: false,
    enableRss: true,
    footerText: 'Powered by Twilight & Halo Engine'
};

const INITIAL_LOGS: AuditLogItem[] = [
    {
        id: 'log-1',
        action: '系统服务初始化',
        detail: '博客管理控制台服务启动成功，RESTful 接口载入完毕',
        level: 'success',
        operator: 'system',
        ip: '127.0.0.1',
        timestamp: '2026-10-07T12:00:00Z'
    },
    {
        id: 'log-2',
        action: '超级管理员登录',
        detail: '账号 admin 通过凭据登录成功',
        level: 'info',
        operator: 'admin',
        ip: '127.0.0.1',
        timestamp: '2026-10-07T12:05:00Z'
    }
];

// 本地存储驱动工具
class LocalFallbackDriver {
    static get<T>(key: string, fallback: T): T {
        if (typeof window === 'undefined') return fallback;
        const saved = localStorage.getItem(`halo_data_${key}`);
        if (!saved) {
            localStorage.setItem(`halo_data_${key}`, JSON.stringify(fallback));
            return fallback;
        }
        try {
            return JSON.parse(saved);
        } catch {
            return fallback;
        }
    }

    static set<T>(key: string, value: T): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem(`halo_data_${key}`, JSON.stringify(value));
    }
}

// 统一 HTTP 请求封装
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${getBaseUrl()}${path}`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('halo_auth_token') : null;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers as any || {})
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5秒超时快速降级

        const res = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            throw new Error(`HTTP error ${res.status}`);
        }
        const json: ApiResponse<T> = await res.json();
        if (json.success) {
            return json.data;
        }
        throw new Error(json.message || 'API request failed');
    } catch {
        throw new Error('BACKEND_UNAVAILABLE');
    }
}

// 1. 认证模块
export const authApi = {
    async login(username: string, password: string): Promise<{ token: string; user: UserProfile }> {
        try {
            return await request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
        } catch {
            if (username === 'admin' && password === 'admin') {
                return {
                    token: 'local-token-admin-' + Date.now(),
                    user: {
                        id: 'u-admin',
                        username: 'admin',
                        name: 'Halo 管理员',
                        email: 'admin@halo.run',
                        role: 'admin',
                        avatar: '/logo.png',
                        bio: '超级系统管理员，全权限管控中枢',
                        status: 'active'
                    }
                };
            }
            throw new Error('用户名或密码错误 (默认 admin / admin)');
        }
    },

    async quickLogin(): Promise<{ token: string; user: UserProfile }> {
        try {
            return await request('/auth/quick-login', { method: 'POST' });
        } catch {
            return {
                token: 'local-token-admin-quick-' + Date.now(),
                user: {
                    id: 'u-admin',
                    username: 'admin',
                    name: 'Halo 管理员',
                    email: 'admin@halo.run',
                    role: 'admin',
                    avatar: '/logo.png',
                    bio: '超级系统管理员，全权限管控中枢',
                    status: 'active'
                }
            };
        }
    },

    async me(): Promise<{ user: UserProfile }> {
        try {
            return await request('/auth/me');
        } catch {
            return {
                user: {
                    id: 'u-admin',
                    username: 'admin',
                    name: 'Halo 管理员',
                    email: 'admin@halo.run',
                    role: 'admin',
                    avatar: '/logo.png',
                    bio: '超级系统管理员，全权限管控中枢',
                    status: 'active'
                }
            };
        }
    },

    async register(data: { username: string; name?: string; email: string; password: string }): Promise<{ user: UserProfile }> {
        try {
            return await request('/auth/register', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        } catch {
            const users = LocalFallbackDriver.get<UserProfile[]>('users', INITIAL_USERS);
            const newUser: UserProfile = {
                id: 'u-' + Date.now(),
                username: data.username,
                name: data.name || data.username,
                email: data.email,
                role: 'reader',
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username}`,
                bio: '新注册用户',
                status: 'active'
            };
            users.push(newUser);
            LocalFallbackDriver.set('users', users);
            return { user: newUser };
        }
    }
};

// 2. 文章管理模块
export const postsApi = {
    async list(params: { keyword?: string; status?: string; category?: string } = {}): Promise<PostItem[]> {
        const query = new URLSearchParams();
        if (params.keyword) query.set('keyword', params.keyword);
        if (params.status) query.set('status', params.status);
        if (params.category) query.set('category', params.category);

        try {
            const qs = query.toString();
            return await request(`/posts${qs ? '?' + qs : ''}`);
        } catch {
            let posts = LocalFallbackDriver.get<PostItem[]>('posts', INITIAL_POSTS);
            if (params.status) {
                posts = posts.filter(p => p.status === params.status);
            }
            if (params.category) {
                posts = posts.filter(p => p.categories.includes(params.category!));
            }
            if (params.keyword) {
                const kw = params.keyword.toLowerCase();
                posts = posts.filter(p => p.title.toLowerCase().includes(kw) || p.content.toLowerCase().includes(kw));
            }
            return posts;
        }
    },

    async get(id: string): Promise<PostItem> {
        try {
            return await request(`/posts/${id}`);
        } catch {
            const posts = LocalFallbackDriver.get<PostItem[]>('posts', INITIAL_POSTS);
            const p = posts.find(item => item.id === id);
            if (!p) throw new Error('文章未找到');
            return p;
        }
    },

    async create(post: Partial<PostItem>): Promise<PostItem> {
        try {
            return await request('/posts', {
                method: 'POST',
                body: JSON.stringify(post)
            });
        } catch {
            const posts = LocalFallbackDriver.get<PostItem[]>('posts', INITIAL_POSTS);
            const newPost: PostItem = {
                id: 'post-' + (posts.length + 1) + '-' + Math.random().toString(36).substring(2, 7),
                title: post.title || '无标题文章',
                slug: post.slug || ('post-' + Date.now()),
                content: post.content || '',
                excerpt: post.excerpt || (post.content ? post.content.substring(0, 100) : ''),
                status: post.status || 'draft',
                pinned: !!post.pinned,
                author: post.author || 'Halo 管理员',
                authorId: 'admin',
                categories: post.categories || ['cat-1'],
                tags: post.tags || ['tag-1'],
                views: 0,
                wordCount: (post.content || '').length,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            posts.unshift(newPost);
            LocalFallbackDriver.set('posts', posts);
            return newPost;
        }
    },

    async update(id: string, post: Partial<PostItem>): Promise<PostItem> {
        try {
            return await request(`/posts/${id}`, {
                method: 'PUT',
                body: JSON.stringify(post)
            });
        } catch {
            const posts = LocalFallbackDriver.get<PostItem[]>('posts', INITIAL_POSTS);
            const idx = posts.findIndex(item => item.id === id);
            if (idx === -1) throw new Error('文章不存在');

            const updated: PostItem = {
                ...posts[idx],
                ...post,
                wordCount: post.content !== undefined ? post.content.length : posts[idx].wordCount,
                updatedAt: new Date().toISOString()
            };
            posts[idx] = updated;
            LocalFallbackDriver.set('posts', posts);
            return updated;
        }
    },

    async delete(id: string): Promise<void> {
        try {
            await request(`/posts/${id}`, { method: 'DELETE' });
        } catch {
            let posts = LocalFallbackDriver.get<PostItem[]>('posts', INITIAL_POSTS);
            posts = posts.filter(p => p.id !== id);
            LocalFallbackDriver.set('posts', posts);
        }
    }
};

// 3. 分类模块
export const categoriesApi = {
    async list(): Promise<CategoryItem[]> {
        try {
            return await request('/categories');
        } catch {
            return LocalFallbackDriver.get<CategoryItem[]>('categories', INITIAL_CATEGORIES);
        }
    },
    async create(data: { name: string; slug: string; description?: string; color?: string }): Promise<CategoryItem> {
        try {
            return await request('/categories', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        } catch {
            const cats = LocalFallbackDriver.get<CategoryItem[]>('categories', INITIAL_CATEGORIES);
            const newCat: CategoryItem = {
                id: 'cat-' + (cats.length + 1),
                name: data.name,
                slug: data.slug || ('cat-' + Date.now()),
                description: data.description || '',
                color: data.color || '#3b82f6',
                count: 0
            };
            cats.push(newCat);
            LocalFallbackDriver.set('categories', cats);
            return newCat;
        }
    },
    async update(id: string, data: Partial<CategoryItem>): Promise<CategoryItem> {
        try {
            return await request(`/categories/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } catch {
            const cats = LocalFallbackDriver.get<CategoryItem[]>('categories', INITIAL_CATEGORIES);
            const idx = cats.findIndex(c => c.id === id);
            if (idx === -1) throw new Error('分类不存在');
            cats[idx] = { ...cats[idx], ...data };
            LocalFallbackDriver.set('categories', cats);
            return cats[idx];
        }
    },
    async delete(id: string): Promise<void> {
        try {
            await request(`/categories/${id}`, { method: 'DELETE' });
        } catch {
            let cats = LocalFallbackDriver.get<CategoryItem[]>('categories', INITIAL_CATEGORIES);
            cats = cats.filter(c => c.id !== id);
            LocalFallbackDriver.set('categories', cats);
        }
    }
};

// 4. 标签模块
export const tagsApi = {
    async list(): Promise<TagItem[]> {
        try {
            return await request('/tags');
        } catch {
            return LocalFallbackDriver.get<TagItem[]>('tags', INITIAL_TAGS);
        }
    },
    async create(data: { name: string; slug: string; color?: string }): Promise<TagItem> {
        try {
            return await request('/tags', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        } catch {
            const tags = LocalFallbackDriver.get<TagItem[]>('tags', INITIAL_TAGS);
            const newTag: TagItem = {
                id: 'tag-' + (tags.length + 1),
                name: data.name,
                slug: data.slug || ('tag-' + Date.now()),
                color: data.color || '#3b82f6',
                count: 0
            };
            tags.push(newTag);
            LocalFallbackDriver.set('tags', tags);
            return newTag;
        }
    },
    async update(id: string, data: Partial<TagItem>): Promise<TagItem> {
        try {
            return await request(`/tags/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } catch {
            const tags = LocalFallbackDriver.get<TagItem[]>('tags', INITIAL_TAGS);
            const idx = tags.findIndex(t => t.id === id);
            if (idx === -1) throw new Error('标签不存在');
            tags[idx] = { ...tags[idx], ...data };
            LocalFallbackDriver.set('tags', tags);
            return tags[idx];
        }
    },
    async delete(id: string): Promise<void> {
        try {
            await request(`/tags/${id}`, { method: 'DELETE' });
        } catch {
            let tags = LocalFallbackDriver.get<TagItem[]>('tags', INITIAL_TAGS);
            tags = tags.filter(t => t.id !== id);
            LocalFallbackDriver.set('tags', tags);
        }
    }
};

// 5. 媒体模块
export const attachmentsApi = {
    async list(): Promise<AttachmentItem[]> {
        try {
            return await request('/attachments');
        } catch {
            return LocalFallbackDriver.get<AttachmentItem[]>('attachments', INITIAL_ATTACHMENTS);
        }
    },
    async create(data: { name: string; url: string; size?: number; type?: string }): Promise<AttachmentItem> {
        try {
            return await request('/attachments', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        } catch {
            const atts = LocalFallbackDriver.get<AttachmentItem[]>('attachments', INITIAL_ATTACHMENTS);
            const newAtt: AttachmentItem = {
                id: 'att-' + (atts.length + 1),
                name: data.name,
                url: data.url,
                size: data.size || 102400,
                type: data.type || 'image/webp',
                uploadedAt: new Date().toISOString()
            };
            atts.unshift(newAtt);
            LocalFallbackDriver.set('attachments', atts);
            return newAtt;
        }
    },
    async delete(id: string): Promise<void> {
        try {
            await request(`/attachments/${id}`, { method: 'DELETE' });
        } catch {
            let atts = LocalFallbackDriver.get<AttachmentItem[]>('attachments', INITIAL_ATTACHMENTS);
            atts = atts.filter(a => a.id !== id);
            LocalFallbackDriver.set('attachments', atts);
        }
    },
    async upload(data: { name: string; url: string; size?: number; type?: string; uploaderId?: string }): Promise<AttachmentItem> {
        return this.create(data);
    },
    async uploadFile(file: File): Promise<AttachmentItem> {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const token = typeof window !== 'undefined' ? localStorage.getItem('halo_auth_token') : null;
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(`${getBaseUrl()}/attachments`, {
                method: 'POST',
                headers,
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const json: ApiResponse<AttachmentItem> = await res.json();
            if (json.success && json.data) {
                return json.data;
            }
            throw new Error(json.message || '上传失败');
        } catch {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const dataUrl = reader.result as string;
                    const atts = LocalFallbackDriver.get<AttachmentItem[]>('attachments', INITIAL_ATTACHMENTS);
                    const newAtt: AttachmentItem = {
                        id: 'att-' + (atts.length + 1) + '-' + Date.now().toString(36),
                        name: file.name,
                        url: dataUrl,
                        size: file.size,
                        type: file.type || 'image/webp',
                        uploadedAt: new Date().toISOString()
                    };
                    atts.unshift(newAtt);
                    LocalFallbackDriver.set('attachments', atts);
                    resolve(newAtt);
                };
                reader.readAsDataURL(file);
            });
        }
    }
};

// 6. 用户管理模块
export const usersApi = {
    async list(): Promise<UserProfile[]> {
        try {
            return await request('/users');
        } catch {
            return LocalFallbackDriver.get<UserProfile[]>('users', INITIAL_USERS);
        }
    },
    async create(data: Partial<UserProfile>): Promise<UserProfile> {
        try {
            return await request('/users', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        } catch {
            const users = LocalFallbackDriver.get<UserProfile[]>('users', INITIAL_USERS);
            const newUser: UserProfile = {
                id: 'u-' + Date.now(),
                username: data.username || 'user_' + Date.now(),
                name: data.name || data.username || '新用户',
                email: data.email || `${data.username || 'user'}@mc00blog.local`,
                role: data.role || 'author',
                avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username || 'user'}`,
                bio: data.bio || '',
                status: 'active'
            };
            users.push(newUser);
            LocalFallbackDriver.set('users', users);
            return newUser;
        }
    },
    async update(id: string, data: Partial<UserProfile>): Promise<UserProfile> {
        try {
            return await request(`/users/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } catch {
            const users = LocalFallbackDriver.get<UserProfile[]>('users', INITIAL_USERS);
            const idx = users.findIndex(u => u.id === id);
            if (idx === -1) throw new Error('用户不存在');
            users[idx] = { ...users[idx], ...data };
            LocalFallbackDriver.set('users', users);
            return users[idx];
        }
    },
    async delete(id: string): Promise<void> {
        try {
            await request(`/users/${id}`, { method: 'DELETE' });
        } catch {
            let users = LocalFallbackDriver.get<UserProfile[]>('users', INITIAL_USERS);
            users = users.filter(u => u.id !== id);
            LocalFallbackDriver.set('users', users);
        }
    }
};

// 7. 站点设置模块
export const settingsApi = {
    async get(): Promise<SiteSettingsItem> {
        try {
            return await request('/settings');
        } catch {
            return LocalFallbackDriver.get<SiteSettingsItem>('settings', INITIAL_SETTINGS);
        }
    },
    async update(data: Partial<SiteSettingsItem>): Promise<SiteSettingsItem> {
        try {
            return await request('/settings', {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } catch {
            const current = LocalFallbackDriver.get<SiteSettingsItem>('settings', INITIAL_SETTINGS);
            const updated = { ...current, ...data };
            LocalFallbackDriver.set('settings', updated);
            return updated;
        }
    }
};

// 8. 操作审计日志模块
export const logsApi = {
    async list(): Promise<AuditLogItem[]> {
        try {
            return await request('/logs');
        } catch {
            return LocalFallbackDriver.get<AuditLogItem[]>('logs', INITIAL_LOGS);
        }
    },
    async create(data: { action: string; detail?: string; level?: 'info' | 'success' | 'warn' | 'error'; operator?: string }): Promise<AuditLogItem> {
        try {
            return await request('/logs', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        } catch {
            const logs = LocalFallbackDriver.get<AuditLogItem[]>('logs', INITIAL_LOGS);
            const newLog: AuditLogItem = {
                id: 'log-' + Date.now(),
                action: data.action,
                detail: data.detail || '',
                level: data.level || 'info',
                operator: data.operator || 'admin',
                ip: '127.0.0.1',
                timestamp: new Date().toISOString()
            };
            logs.unshift(newLog);
            if (logs.length > 100) logs.pop();
            LocalFallbackDriver.set('logs', logs);
            return newLog;
        }
    },
    async record(data: { action: string; detail?: string; level?: 'info' | 'success' | 'warn' | 'error'; operator?: string }): Promise<AuditLogItem> {
        return this.create(data);
    }
};

// 辅助：生成 20 桶吞吐量数据（每桶 10 分钟，覆盖 3 小时 20 分）
function generateLocalThroughputBuckets(): ThroughputBucket[] {
    const buckets: ThroughputBucket[] = [];
    const now = Date.now();
    const samples = [
        { success: 84, fail: 1 }, { success: 96, fail: 2 }, { success: 72, fail: 0 },
        { success: 110, fail: 3 }, { success: 65, fail: 1 }, { success: 128, fail: 0 },
        { success: 92, fail: 1 }, { success: 54, fail: 0 }, { success: 88, fail: 2 },
        { success: 76, fail: 1 }, { success: 102, fail: 2 }, { success: 64, fail: 0 },
        { success: 85, fail: 1 }, { success: 118, fail: 3 }, { success: 90, fail: 1 },
        { success: 70, fail: 0 }, { success: 62, fail: 1 }, { success: 45, fail: 0 },
        { success: 58, fail: 1 }, { success: 36, fail: 0 },
    ];

    for (let i = 19; i >= 0; i--) {
        const slotTime = new Date(now - i * 10 * 60 * 1000);
        const dist = samples[19 - i] || { success: 60, fail: 1 };
        const total = dist.success + dist.fail;
        const hours = String(slotTime.getHours()).padStart(2, '0');
        const minutes = String(slotTime.getMinutes()).padStart(2, '0');
        buckets.push({
            index: 20 - i,
            time: `${hours}:${minutes}`,
            timestamp: slotTime.getTime(),
            success: dist.success,
            fail: dist.fail,
            total,
            rate: total > 0 ? Math.round((dist.success / total) * 1000) / 10 : 100,
            latency: `${Math.floor(Math.random() * 25 + 20)}ms`
        });
    }

    return buckets;
}

// 9. 仪表盘统计模块
export const statsApi = {
    async get(): Promise<DashboardStats> {
        try {
            return await request('/stats');
        } catch {
            const posts = LocalFallbackDriver.get<PostItem[]>('posts', INITIAL_POSTS);
            const cats = LocalFallbackDriver.get<CategoryItem[]>('categories', INITIAL_CATEGORIES);
            const tags = LocalFallbackDriver.get<TagItem[]>('tags', INITIAL_TAGS);
            const atts = LocalFallbackDriver.get<AttachmentItem[]>('attachments', INITIAL_ATTACHMENTS);
            const users = LocalFallbackDriver.get<UserProfile[]>('users', INITIAL_USERS);

            let totalWords = 0;
            let publishedCount = 0;
            let draftCount = 0;
            let recycleCount = 0;

            for (const p of posts) {
                totalWords += (p.wordCount || 0);
                if (p.status === 'published') publishedCount++;
                else if (p.status === 'draft') draftCount++;
                else recycleCount++;
            }

            const totalPosts = posts.length - recycleCount;
            const publishRate = totalPosts > 0 ? Math.round((publishedCount / totalPosts) * 100) : 0;
            const buckets = generateLocalThroughputBuckets();

            let totalReqs = 0;
            let successReqs = 0;
            let failReqs = 0;
            for (const b of buckets) {
                totalReqs += b.total;
                successReqs += b.success;
                failReqs += b.fail;
            }

            const throughput: ThroughputData = {
                windowLabel: '滚动窗口 3 小时 20 分 · 每桶 10 分钟',
                granularity: '10 分钟',
                totalRequests: totalReqs || 1595,
                successRequests: successReqs || 1575,
                failedRequests: failReqs || 20,
                successRate: totalReqs > 0 ? Math.round((successReqs / totalReqs) * 1000) / 10 : 98.7,
                credentialsCount: 4,
                credentialsDesc: '4 个可用 · 0 个未参与调度',
                providerKeyCount: 0,
                providerKeyDesc: '所有品牌已配置的 API Key 总数',
                modelCount: 29,
                modelDesc: '通过代理端点暴露的模型',
                buckets
            };

            return {
                totalWords,
                totalPosts,
                publishedCount,
                draftCount,
                recycleCount,
                publishRate,
                categoryCount: cats.length,
                tagCount: tags.length,
                attachmentCount: atts.length,
                userCount: users.length || 4,
                recentPosts: posts.slice(0, 5),
                systemStatus: 'NORMAL',
                healthMessage: '运行平稳。',
                version: 'v8.0.10',
                throughput
            };
        }
    }
};
