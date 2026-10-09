/**
 * 前后端解耦的标准 API 数据契约与类型定义
 * 严格对齐 RESTful 规范，与 Java Web (Spring Boot) 实体 100% 映射
 */

export interface ApiResponse<T = any> {
    success: boolean;
    data: T;
    message: string;
    timestamp: number;
}

export interface UserProfile {
    id: string;
    username: string;
    name: string;
    email: string;
    role: 'admin' | 'editor' | 'author' | 'contributor' | 'reader';
    avatar?: string;
    bio?: string;
    status?: 'active' | 'disabled';
}

export interface PostItem {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    status: 'published' | 'draft' | 'recycle';
    pinned: boolean;
    author: string;
    authorId: string;
    categories: string[];
    tags: string[];
    views: number;
    wordCount: number;
    createdAt: string;
    updatedAt: string;
    /** 所属文章文件夹路径 (空串 = 文章根目录), 与站点 src/content/posts 目录一致 */
    folder?: string;
    /** 正文格式: markdown / mdx / html */
    format?: string;
}

export interface CategoryItem {
    id: string;
    name: string;
    slug: string;
    description: string;
    color?: string;
    count: number;
    parentId?: string | null;
}

export interface TagItem {
    id: string;
    name: string;
    slug: string;
    color: string;
    count: number;
}

export interface AttachmentItem {
    id: string;
    name: string;
    url: string;
    size: number;
    type: string;
    uploadedAt: string;
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

export interface DashboardStats {
    totalWords: number;
    totalPosts: number;
    publishedCount: number;
    draftCount: number;
    recycleCount?: number;
    publishRate: number;
    categoryCount: number;
    tagCount: number;
    attachmentCount: number;
    userCount: number;
    recentPosts: PostItem[];
    systemStatus: string;
    healthMessage: string;
    version: string;
    throughput?: ThroughputData;
}

export interface AuditLogItem {
    id: string;
    action: string;
    detail: string;
    level: 'info' | 'success' | 'warn' | 'error';
    operator: string;
    ip?: string;
    timestamp: string;
}

export interface SiteSettingsItem {
    siteName: string;
    siteSubtitle: string;
    announcement: string;
    allowRegistration: boolean;
    allowComments: boolean;
    copyProtection: boolean;
    enableRss: boolean;
    footerText: string;
}
