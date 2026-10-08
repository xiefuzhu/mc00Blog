/**
 * Halo 风格预置种子数据与 RBAC 规则字典
 * 规范：绝对禁止输出任何 Emoji 表情符号
 */

import type { Role, User, Category, Tag, Post, Attachment, SiteSettings, UserRole } from "./types";

export const DEFAULT_ROLES: Role[] = [
    {
        id: "admin",
        name: "超级管理员",
        description: "拥有系统全量控制权限，包括用户、角色、文章、系统设置与附件管理",
        isSystem: true,
        disallowAccessConsole: false,
        permissions: ["*"],
        badgeColor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
    },
    {
        id: "editor",
        name: "文章管理员",
        description: "管理所有文章、分类、标签与媒体资源，但无权修改系统设置和用户角色",
        isSystem: true,
        disallowAccessConsole: false,
        permissions: [
            "posts:*",
            "categories:*",
            "tags:*",
            "attachments:*",
            "view:public"
        ],
        badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    },
    {
        id: "author",
        name: "签约作者",
        description: "可创建与编辑属于自己的文章和草稿，上传个人素材，不可管理他人文章",
        isSystem: true,
        disallowAccessConsole: false,
        permissions: [
            "posts:create",
            "posts:edit:own",
            "posts:delete:own",
            "posts:publish",
            "attachments:*",
            "view:public"
        ],
        badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    },
    {
        id: "contributor",
        name: "投稿者",
        description: "可提交文章草稿，但无法直接公开上线，需管理员审核",
        isSystem: true,
        disallowAccessConsole: false,
        permissions: [
            "posts:create",
            "posts:edit:own",
            "attachments:*",
            "view:public"
        ],
        badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    },
    {
        id: "reader",
        name: "访客读者",
        description: "普通浏览读者，仅拥有前台浏览与个人中心资料查看权限，禁止访问后台控制台",
        isSystem: true,
        disallowAccessConsole: true,
        permissions: ["view:public"],
        badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    },
];

export const ROLE_INFO: Record<UserRole, { label: string; desc: string; badgeColor: string }> = {
    admin: {
        label: "超级管理员",
        desc: "系统全量控制权限",
        badgeColor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
    },
    editor: {
        label: "文章管理员",
        desc: "文章与内容全量管理",
        badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    },
    author: {
        label: "签约作者",
        desc: "仅管理本人创作内容",
        badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    },
    contributor: {
        label: "投稿撰稿人",
        desc: "提交初稿与排版",
        badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    },
    reader: {
        label: "普通读者",
        desc: "仅前台阅读与个人资料",
        badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    },
};

export const DEFAULT_USERS: User[] = [
    {
        id: "u-admin",
        username: "admin",
        name: "Halo 管理员",
        displayName: "Halo 管理员",
        email: "admin@mc00blog.local",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=HaloAdmin",
        role: "admin",
        bio: "博客主站超级管理员，负责全站架构、用户权限与内容总编审。",
        createdAt: "2026-01-01T08:00:00.000Z",
        status: "active",
    },
    {
        id: "u-editor",
        username: "editor_alex",
        name: "内容主管 Alex",
        displayName: "内容主管 Alex",
        email: "alex@mc00blog.local",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=AlexEditor",
        role: "editor",
        bio: "负责文章栏目策划、分类流转与高质量稿件校对。",
        createdAt: "2026-02-15T09:30:00.000Z",
        status: "active",
    },
    {
        id: "u-author",
        username: "author_tom",
        name: "签约专栏作家 Tom",
        displayName: "签约专栏作家 Tom",
        email: "tom@mc00blog.local",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=TomAuthor",
        role: "author",
        bio: "专注于 Astro 现代前端技术与全栈工程架构探索。",
        createdAt: "2026-03-01T14:20:00.000Z",
        status: "active",
    },
    {
        id: "u-contributor",
        username: "writer_lucy",
        name: "投稿人 Lucy",
        displayName: "投稿人 Lucy",
        email: "lucy@mc00blog.local",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=LucyWriter",
        role: "contributor",
        bio: "热爱分享开源心得与设计美学。",
        createdAt: "2026-03-20T11:10:00.000Z",
        status: "active",
    },
    {
        id: "u-reader",
        username: "reader_bob",
        name: "读者 Bob",
        displayName: "读者 Bob",
        email: "bob@mc00blog.local",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=BobReader",
        role: "reader",
        bio: "普通读者账号，用于测试非授权用户拦截。",
        createdAt: "2026-04-05T16:00:00.000Z",
        status: "active",
    },
];

export const DEFAULT_CATEGORIES: Category[] = [
    {
        id: "cat-engineering",
        name: "技术架构",
        slug: "architecture",
        description: "系统设计、工程化演进与全栈架构实践深度分享",
        color: "#3b82f6",
        priority: 1,
        postCount: 2,
    },
    {
        id: "cat-frontend",
        name: "前端工程",
        slug: "frontend",
        description: "Astro、Svelte 5、Tailwind CSS 等现代前端生态探索",
        color: "#10b981",
        priority: 2,
        postCount: 2,
    },
    {
        id: "cat-open-source",
        name: "开源生态",
        slug: "opensource",
        description: "优秀开源项目解析、Halo 建站工具及扩展开发",
        color: "#8b5cf6",
        priority: 3,
        postCount: 1,
    },
    {
        id: "cat-essays",
        name: "生活随笔",
        slug: "essays",
        description: "关于阅读、思考与数字生活的随记",
        color: "#f59e0b",
        priority: 4,
        postCount: 1,
    },
];

export const DEFAULT_TAGS: Tag[] = [
    { id: "tag-halo", name: "Halo", slug: "halo", color: "#6366f1", postCount: 2 },
    { id: "tag-astro", name: "Astro", slug: "astro", color: "#ec4899", postCount: 3 },
    { id: "tag-svelte", name: "Svelte 5", slug: "svelte5", color: "#f97316", postCount: 2 },
    { id: "tag-rbac", name: "RBAC权限", slug: "rbac", color: "#ef4444", postCount: 2 },
    { id: "tag-tailwind", name: "Tailwind CSS", slug: "tailwind", color: "#06b6d4", postCount: 2 },
];

export const DEFAULT_POSTS: Post[] = [
    {
        id: "post-halo-migration",
        title: "Halo 2.0 风格管理控制台重构实践：解耦与沉浸式体验",
        slug: "halo-console-migration-guide",
        summary: "深入剖析如何将臃肿割裂的前台弹窗彻底解耦为独立的专业级管理后台，融合 RBAC 权限控制与现代化工作台。",
        content: `## 为什么需要重构？

在早期的博客迭代中，管理面板被错误地设计成了一个挂载在所有前台页面的全屏弹窗。这一设计带来了严重的体验问题：

- **视觉遮挡与冲突**：浏览博客内容时打开弹窗，严重遮蔽原有页面，视窗切换极其割裂。
- **性能与渲染开销**：首屏加载时携带了大量不属于普通读者的管理代码与编辑器逻辑。
- **权限边界不清**：读者和管理员未实现物理路由隔离。

## Halo 2.0 的架构启发

通过深入调研开源建站工具 **Halo 2.0** 的设计，我们汲取了以下核心理念：

1. **工作台与前台分离**：前台保留轻量级状态卡片，后台拥有专属的 \`/console\` 路由。
2. **严密的 RBAC 体系**：基于角色与权限模型（Role-Based Access Control），支持禁止未授权角色访问控制台。
3. **沉浸式双栏创作流**：左侧实时编写 Markdown，右侧双向渲染与抽屉式属性配置。

\`\`\`typescript
// Halo 核心鉴权思想
export function canAccessConsole(user: User, role: Role): boolean {
    if (!user || user.status === 'disabled') return false;
    return !role.disallowAccessConsole;
}
\`\`\`

:::tip [落地收益]
重构后，前台保持了纯净高效的 Twilight 玻璃质感，而后台则提供了独立完整的工作台操作流。
:::
`,
        status: "published",
        visibility: "public",
        pinned: true,
        allowComment: true,
        categories: ["cat-engineering", "cat-open-source"],
        tags: ["tag-halo", "tag-rbac"],
        authorId: "u-admin",
        authorName: "Halo 管理员",
        views: 1248,
        wordCount: 520,
        readingTime: 2,
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-02T16:30:00.000Z",
    },
    {
        id: "post-svelte-runes",
        title: "深入浅出 Svelte 5：Runes 响应式驱动的现代状态管理",
        slug: "svelte-5-runes-deep-dive",
        summary: "全面解析 Svelte 5 全新 Runes 系统（$state、$derived、$props），探索组件状态解耦与持久化最佳模式。",
        content: `## Svelte 5 的响应式革命

Svelte 5 引入了全新的 **Runes** 概念，统一了在组件内部与独立 \`.svelte.ts\` 文件中的响应式声明。

### 核心 Runes 概览

- \`$state(initialValue)\`：声明可变响应式状态。
- \`$derived(expression)\`：声明派生计算属性。
- \`$props()\`：解构组件接收的外部入参。

\`\`\`svelte
<script lang="ts">
let count = $state(0);
let double = $derived(count * 2);

function increment() {
    count += 1;
}
</script>

<button onclick={increment}>
    点击: {count} (双倍: {double})
</button>
\`\`\`

## 在解耦架构中的应用

在本次博客后台重构中，我们使用 \`class Store\` 结合 \`$state\` 构建了响应式单例，使得控制台、导航栏和编辑器之间的数据无缝同步，无需引入沉重的外部状态库。
`,
        status: "published",
        visibility: "public",
        pinned: false,
        allowComment: true,
        categories: ["cat-frontend"],
        tags: ["tag-svelte", "tag-astro"],
        authorId: "u-author",
        authorName: "签约专栏作家 Tom",
        views: 890,
        wordCount: 430,
        readingTime: 2,
        createdAt: "2026-04-03T14:15:00.000Z",
        updatedAt: "2026-04-03T18:00:00.000Z",
    },
    {
        id: "post-astro-liquid-glass",
        title: "Astro 与 Twilight 毛玻璃视觉：打造高通透感现代博客",
        slug: "astro-twilight-liquid-glass",
        summary: "如何基于 CSS Backdrop Filter、动态色彩变量（--hue/--primary）实现多主题自适应的高级磨砂质感。",
        content: `## 视觉设计理念

Twilight 风格的核心在于**高通透感与物理流动感**。通过将背景壁纸、半透明磨砂卡片以及动态色调相结合，让整个博客呈现出兼具现代感与空灵感的视觉语言。

### 样式核心变量

在全局样式中，我们维护了以下色彩与模糊基准：

\`\`\`css
:root {
    --primary: oklch(0.7 0.18 var(--hue));
    --glass-blur: 16px;
    --glass-bg: rgba(255, 255, 255, 0.65);
}

:root.dark {
    --glass-bg: rgba(20, 20, 25, 0.7);
}
\`\`\`

不论是前台文章卡片，还是 Halo 控制台中的仪表盘部件，统一遵循这套质感规范，实现完美的视觉延续。
`,
        status: "published",
        visibility: "public",
        pinned: false,
        allowComment: true,
        categories: ["cat-frontend"],
        tags: ["tag-astro", "tag-tailwind"],
        authorId: "u-author",
        authorName: "签约专栏作家 Tom",
        views: 654,
        wordCount: 380,
        readingTime: 2,
        createdAt: "2026-04-05T09:20:00.000Z",
        updatedAt: "2026-04-05T09:20:00.000Z",
    },
    {
        id: "post-draft-next-gen",
        title: "下一代轻量化内容发布系统架构思考（草稿）",
        slug: "next-gen-cms-architecture-draft",
        summary: "关于去中心化写作、Git-native 内容版本控制与浏览器离线持久化机制的探索草稿。",
        content: `## 初稿提纲

1. 纯静态站点（SSG）在动态内容管理中的挑战
2. 本地存储（IndexedDB / LocalStorage）作为离线安全沙箱的可行性
3. 一键导出标准 Frontmatter 文件的工程闭环
4. 权限模型的最小化授权策略
`,
        status: "draft",
        visibility: "private",
        pinned: false,
        allowComment: false,
        categories: ["cat-engineering"],
        tags: ["tag-halo", "tag-rbac"],
        authorId: "u-contributor",
        authorName: "投稿人 Lucy",
        views: 45,
        wordCount: 160,
        readingTime: 1,
        createdAt: "2026-04-06T15:00:00.000Z",
        updatedAt: "2026-04-06T15:00:00.000Z",
    },
];

export const DEFAULT_ATTACHMENTS: Attachment[] = [
    {
        id: "att-1",
        name: "halo-console-hero.webp",
        url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&auto=format&fit=crop&q=80",
        size: 145280,
        type: "image/webp",
        uploadTime: "2026-04-01T10:15:00.000Z",
        uploaderId: "u-admin",
    },
    {
        id: "att-2",
        name: "svelte-runes-diagram.png",
        url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop&q=80",
        size: 204890,
        type: "image/png",
        uploadTime: "2026-04-03T14:30:00.000Z",
        uploaderId: "u-author",
    },
    {
        id: "att-3",
        name: "frosted-glass-preview.jpg",
        url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1200&auto=format&fit=crop&q=80",
        size: 312500,
        type: "image/jpeg",
        uploadTime: "2026-04-05T09:40:00.000Z",
        uploaderId: "u-author",
    },
];

export const DEFAULT_SETTINGS: SiteSettings = {
    siteName: "MC00 博客管理台",
    siteSubtitle: "Halo 风格架构 · 沉浸式内容发布与 RBAC 权限中心",
    announcement: "欢迎访问全新重构的博客控制台，体验多角色权限与流畅创作流！",
    allowRegistration: true,
    allowComments: true,
    copyProtection: false,
    enableRss: true,
    footerText: "Powered by Twilight Theme & Halo Console Architecture",
};
