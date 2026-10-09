/**
 * 业务数据 REST 客户端 (分类 / 标签 / 媒体 / 用户 / 设置 / 日志 / 统计)
 *
 * 统一经 lib/backend 的 backendRequest 访问 PHP 后端, 使用统一业务信封
 * ( { success, data, message } )。后端不可达时直接返回失败, 不做任何本地兜底。
 */

import { backendRequest, buildUrl, getAuthToken, pingBackend, type ApiResult } from "@/lib/backend";
import { getAuthKey, getBackendBaseUrl, setBackendBaseUrl } from "@/config/backend";
import type {
    UserProfile,
    PostItem,
    CategoryItem,
    TagItem,
    AttachmentItem,
    DashboardStats,
    AuditLogItem,
    SiteSettingsItem,
} from "./types";

export { pingBackend };
export type { ApiResult };

/** 后端 BaseURL (含 /api 前缀) */
export function getBaseUrl(): string {
    return getBackendBaseUrl();
}

export function setBaseUrl(url: string): void {
    setBackendBaseUrl(url);
}

/** 业务信封请求: 失败时抛出 Error, 便于调用方 catch */
async function call<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const result = await backendRequest<T>(path, { ...options, mode: "envelope" });
    if (!result.ok) throw new Error(result.error);
    return result.data;
}

/* -------------------------------------------------------------------------- */
/* 认证                                                                        */
/* -------------------------------------------------------------------------- */

export const authApi = {
    login(username: string, password: string): Promise<{ token: string; user: UserProfile }> {
        return call("/auth/login", { method: "POST", body: { username, password } });
    },
    quickLogin(): Promise<{ token: string; user: UserProfile }> {
        return call("/auth/quick-login", { method: "POST" });
    },
    me(): Promise<{ user: UserProfile }> {
        return call("/auth/me");
    },
    register(data: { username: string; name?: string; email: string; password: string }): Promise<{ user: UserProfile }> {
        return call("/auth/register", { method: "POST", body: data });
    },
};

/* -------------------------------------------------------------------------- */
/* 文章 (业务信封; 文章文件的实际读写走 contentApi)                             */
/* -------------------------------------------------------------------------- */

export const postsApi = {
    list(params: { keyword?: string; status?: string; category?: string; folder?: string } = {}): Promise<PostItem[]> {
        const query = new URLSearchParams();
        if (params.keyword) query.set("keyword", params.keyword);
        if (params.status) query.set("status", params.status);
        if (params.category) query.set("category", params.category);
        if (params.folder) query.set("folder", params.folder);
        const qs = query.toString();
        return call(`/posts${qs ? "?" + qs : ""}`);
    },
    get(id: string): Promise<PostItem> {
        return call(`/posts/${encodeURIComponent(id)}`);
    },
    create(post: Partial<PostItem>): Promise<PostItem> {
        return call("/posts", { method: "POST", body: post });
    },
    update(id: string, post: Partial<PostItem>): Promise<PostItem> {
        return call(`/posts/${encodeURIComponent(id)}`, { method: "PUT", body: post });
    },
    delete(id: string): Promise<void> {
        return call(`/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
};

/* -------------------------------------------------------------------------- */
/* 分类 / 标签                                                                 */
/* -------------------------------------------------------------------------- */

export const categoriesApi = {
    list: (): Promise<CategoryItem[]> => call("/categories"),
    create: (data: { name: string; slug: string; description?: string; color?: string }): Promise<CategoryItem> =>
        call("/categories", { method: "POST", body: data }),
    update: (id: string, data: Partial<CategoryItem>): Promise<CategoryItem> =>
        call(`/categories/${encodeURIComponent(id)}`, { method: "PUT", body: data }),
    delete: (id: string): Promise<void> => call(`/categories/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const tagsApi = {
    list: (): Promise<TagItem[]> => call("/tags"),
    create: (data: { name: string; slug: string; color?: string }): Promise<TagItem> =>
        call("/tags", { method: "POST", body: data }),
    update: (id: string, data: Partial<TagItem>): Promise<TagItem> =>
        call(`/tags/${encodeURIComponent(id)}`, { method: "PUT", body: data }),
    delete: (id: string): Promise<void> => call(`/tags/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

/* -------------------------------------------------------------------------- */
/* 媒体附件                                                                    */
/* -------------------------------------------------------------------------- */

export const attachmentsApi = {
    list: (): Promise<AttachmentItem[]> => call("/attachments"),
    create: (data: { name: string; url: string; size?: number; type?: string }): Promise<AttachmentItem> =>
        call("/attachments", { method: "POST", body: data }),
    delete: (id: string): Promise<void> => call(`/attachments/${encodeURIComponent(id)}`, { method: "DELETE" }),
    upload(data: { name: string; url: string; size?: number; type?: string }): Promise<AttachmentItem> {
        return this.create(data);
    },
    async uploadFile(file: File): Promise<AttachmentItem> {
        const formData = new FormData();
        formData.append("file", file);
        const credential = getAuthToken() || getAuthKey();
        const headers: Record<string, string> = {};
        if (credential) headers["Authorization"] = `Bearer ${credential}`;

        const response = await fetch(buildUrl("/attachments"), { method: "POST", headers, body: formData });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || payload.success !== true) {
            throw new Error(payload?.message || `HTTP ${response.status}`);
        }
        return payload.data as AttachmentItem;
    },
};

/* -------------------------------------------------------------------------- */
/* 用户 / 设置 / 日志 / 统计                                                    */
/* -------------------------------------------------------------------------- */

export const usersApi = {
    list: (): Promise<UserProfile[]> => call("/users"),
    create: (data: Partial<UserProfile>): Promise<UserProfile> => call("/users", { method: "POST", body: data }),
    update: (id: string, data: Partial<UserProfile>): Promise<UserProfile> =>
        call(`/users/${encodeURIComponent(id)}`, { method: "PUT", body: data }),
    delete: (id: string): Promise<void> => call(`/users/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const settingsApi = {
    get: (): Promise<SiteSettingsItem> => call("/settings"),
    update: (data: Partial<SiteSettingsItem>): Promise<SiteSettingsItem> =>
        call("/settings", { method: "PUT", body: data }),
};

export const logsApi = {
    list: (): Promise<AuditLogItem[]> => call("/logs"),
    create: (data: { action: string; detail?: string; level?: string; operator?: string }): Promise<AuditLogItem> =>
        call("/logs", { method: "POST", body: data }),
    record(data: { action: string; detail?: string; level?: string; operator?: string }): Promise<AuditLogItem> {
        return this.create(data);
    },
};

export const statsApi = {
    get: (): Promise<DashboardStats> => call("/stats"),
};
