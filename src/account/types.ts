/**
 * 账号与权限系统类型定义 (Halo 2.0 RBAC 体系与解耦模型)
 * Decoupled Account & RBAC Management System Types
 */

export type UserRole = "admin" | "editor" | "author" | "contributor" | "reader";

export interface Role {
    id: string;
    name: string;
    description: string;
    isSystem: boolean;
    disallowAccessConsole?: boolean;
    permissions: string[];
    badgeColor: string;
}

export type Permission =
    | "*"
    | "posts:*"
    | "posts:create"
    | "posts:edit:own"
    | "posts:edit:all"
    | "posts:delete:own"
    | "posts:delete:all"
    | "posts:publish"
    | "categories:*"
    | "tags:*"
    | "attachments:*"
    | "users:*"
    | "roles:*"
    | "logs:*"
    | "settings:*"
    | "view:public";

export interface User {
    id: string;
    username: string;
    name: string; // 兼容旧接口
    displayName?: string; // Halo 标准
    email: string;
    password?: string;
    avatar: string;
    customAvatarUrl?: string;
    role: UserRole;
    bio?: string;
    createdAt: string;
    status?: "active" | "disabled";
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string;
    parentId?: string | null;
    color?: string;
    cover?: string;
    priority?: number;
    postCount?: number;
    createdAt?: string;
}

// 兼容别名
export type CategoryFolder = Category;

export interface Tag {
    id: string;
    name: string;
    slug: string;
    color?: string;
    postCount?: number;
}

export interface Post {
    id: string;
    title: string;
    slug: string;
    content: string;
    summary: string;
    excerpt?: string; // 兼容旧别名
    cover?: string;
    status: "published" | "draft" | "recycle";
    visibility: "public" | "private";
    pinned: boolean;
    allowComment: boolean;
    categories: string[]; // category IDs or slugs
    categoryId?: string; // 兼容旧单选字段
    categoryName?: string;
    tags: string[];
    authorId: string;
    authorName: string;
    views: number;
    wordCount: number;
    readingTime: number;
    createdAt: string;
    updatedAt: string;
    filePath?: string;
}

// 兼容旧 Article 别名
export type Article = Post;

export interface Attachment {
    id: string;
    name: string;
    url: string;
    size: number; // 字节
    type: string; // mime type
    uploadTime: string;
    uploaderId: string;
}

export interface SiteSettings {
    siteName: string;
    siteSubtitle: string;
    announcement: string;
    allowRegistration: boolean;
    allowComments: boolean;
    copyProtection: boolean;
    enableRss: boolean;
    footerText: string;
}

export interface AuditLog {
    id: string;
    action: string;
    detail: string;
    level: "info" | "success" | "warn" | "error";
    operator: string;
    ip?: string;
    timestamp: string;
}

export interface ThroughputBucket {
    index: number;
    time: string;
    timestamp: number;
    success: number;
    fail: number;
    total: number;
    rate: number;
    latency: string;
}

export interface ThroughputData {
    windowLabel: string;
    granularity: string;
    totalRequests: number;
    successRequests: number;
    failedRequests: number;
    successRate: number;
    credentialsCount: number;
    credentialsDesc: string;
    providerKeyCount: number;
    providerKeyDesc: string;
    modelCount: number;
    modelDesc: string;
    buckets: ThroughputBucket[];
}

export type ConsoleTab =
    | "dashboard"
    | "posts"
    | "editor"
    | "categories"
    | "tags"
    | "attachments"
    | "logs"
    | "users"
    | "roles"
    | "uc"
    | "settings"
    | "keeper"
    | "articles" // 兼容旧 tab
    | "profile"; // 兼容旧 tab

export type ModalTab = ConsoleTab;

export interface FullBackupBundle {
    version: string;
    exportedAt: string;
    site: string;
    settings: SiteSettings;
    categories: Category[];
    tags: Tag[];
    posts: Post[];
    attachments: Attachment[];
    users?: Omit<User, "password">[];
}
