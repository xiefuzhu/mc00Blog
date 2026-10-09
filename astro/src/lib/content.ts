/**
 * 运行时内容层 (服务端专用)
 *
 * 公开博客的文章列表、单篇文章与目录树都在请求时从 PHP 后端拉取:
 *   GET /api/public/posts[?withContent=1]
 *   GET /api/public/posts/{id}
 *   GET /api/public/directory
 *   GET /api/public/asset?collection=&path=
 *
 * 后端不可达时一律返回空结果, 不做任何本地兜底 —— 这是「前端拿不到文章就显示空内容」
 * 的实现方式。渲染也在服务端完成 (markdown-it + katex, 与前端预览同源)。
 *
 * 本文件依赖 node-html-parser, 只能在服务端 import。
 */

import { parse as parseHtml } from "node-html-parser";

import { renderContent, extractHtmlBody } from "@/account/preview";
import { getBackendBaseUrl } from "@/config/backend";
import { backendRequest } from "@/lib/backend";
import { getCategoryPathParts } from "@utils/category";
import { parseTags } from "@utils/tag";

export type PostFormat = "markdown" | "mdx" | "html";

export interface TocHeading {
    depth: number;
    slug: string;
    text: string;
}

export interface PostReadingMeta {
    excerpt: string;
    words: number;
    minutes: number;
}

export interface PostCopyProtection {
    blockSelection: boolean;
    blockClipboard: boolean;
    blockContextMenu: boolean;
    blockDevTools: boolean;
}

/** 归一化后的文章 frontmatter (字段与 Astro 内容集合 schema 保持一致) */
export interface PostData {
    title: string;
    directoryTitle: string;
    published: Date;
    updated?: Date;
    description: string;
    cover: string;
    coverInContent: boolean;
    category: string[] | string;
    tags: string[];
    lang: string;
    pinned: boolean;
    author: string;
    sourceLink: string;
    licenseName: string;
    licenseUrl: string;
    comment: boolean;
    draft: boolean;
    encrypted: boolean;
    password: string;
    copyProtection: PostCopyProtection;
    routeName?: string;
    prevTitle: string;
    prevSlug: string;
    nextTitle: string;
    nextSlug: string;
}

export interface PostEntry {
    /** 集合内唯一 id (不含扩展名, 可含子目录) */
    id: string;
    data: PostData;
    /** 原始正文 (不含 frontmatter); 列表接口默认不返回, 为空串 */
    body: string;
    /** 仓库相对文件路径 (形如 articles/posts/guide/Getting Started.md) */
    filePath: string;
    format: PostFormat;
    /** 前台真实路由 */
    url: string;
    /** 集合内相对路径 (含扩展名) */
    relPath: string;
    /** 集合内所在文件夹路径 (空串表示集合根目录) */
    folderPath: string;
    reading: PostReadingMeta;
}

export interface RenderedPost {
    html: string;
    headings: TocHeading[];
    frontmatter: PostReadingMeta;
}

const DEFAULT_COPY_PROTECTION: PostCopyProtection = {
    blockSelection: false,
    blockClipboard: false,
    blockContextMenu: false,
    blockDevTools: false,
};

/* -------------------------------------------------------------------------- */
/* 基础工具                                                                    */
/* -------------------------------------------------------------------------- */

function asString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function toDate(value: unknown): Date | undefined {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
    if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    return undefined;
}

function normalizeCopyProtection(value: unknown): PostCopyProtection {
    if (!value || typeof value !== "object") return { ...DEFAULT_COPY_PROTECTION };
    const source = value as Record<string, unknown>;
    return {
        blockSelection: asBool(source.blockSelection),
        blockClipboard: asBool(source.blockClipboard),
        blockContextMenu: asBool(source.blockContextMenu),
        blockDevTools: asBool(source.blockDevTools),
    };
}

/** 把集合内的相对资源路径改写为后端资源接口的绝对地址 */
export function resolveAssetUrl(collection: string, folderPath: string, rawPath: string): string {
    const value = (rawPath || "").trim();
    if (!value) return "";
    if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:") || value.startsWith("/")) {
        return value;
    }
    const base = folderPath ? `${folderPath}/` : "";
    const target = `${base}${value}`.replace(/^\.\//, "");
    return `${getBackendBaseUrl()}/public/asset?collection=${encodeURIComponent(collection)}&path=${encodeURIComponent(target)}`;
}

/* -------------------------------------------------------------------------- */
/* 归一化                                                                      */
/* -------------------------------------------------------------------------- */

// biome-ignore lint/suspicious/noExplicitAny: 后端返回的是无类型的 JSON
function normalizePost(raw: any): PostEntry {
    const data = (raw?.data ?? {}) as Record<string, unknown>;
    const id = asString(raw?.id);
    const relPath = asString(raw?.relPath, `${id}.md`);
    const folderPath = asString(raw?.folderPath);
    const format = (asString(raw?.format, "markdown") as PostFormat) || "markdown";

    const published = toDate(data.published) ?? toDate(data.updated) ?? new Date();
    const categoryParts = getCategoryPathParts(data.category as never);

    return {
        id,
        relPath,
        folderPath,
        format,
        url: asString(raw?.url, `/posts/${id}/`),
        filePath: `articles/posts/${relPath}`,
        body: asString(raw?.content),
        reading: {
            excerpt: asString(raw?.excerpt),
            words: Number(raw?.words) || 0,
            minutes: Number(raw?.minutes) || 1,
        },
        data: {
            title: asString(data.title, id),
            directoryTitle: asString(data.directoryTitle),
            published,
            updated: toDate(data.updated),
            description: asString(data.description),
            cover: resolveAssetUrl("posts", folderPath, asString(data.cover)),
            coverInContent: asBool(data.coverInContent),
            category: categoryParts ?? asString(data.category),
            tags: parseTags(data.tags as never),
            lang: asString(data.lang),
            pinned: asBool(data.pinned),
            author: asString(data.author),
            sourceLink: asString(data.sourceLink),
            licenseName: asString(data.licenseName),
            licenseUrl: asString(data.licenseUrl),
            comment: data.comment !== false,
            draft: asBool(data.draft),
            encrypted: asBool(data.encrypted),
            password: asString(data.password),
            copyProtection: normalizeCopyProtection(data.copyProtection),
            routeName: typeof data.routeName === "string" ? data.routeName : undefined,
            prevTitle: "",
            prevSlug: "",
            nextTitle: "",
            nextSlug: "",
        },
    };
}

/* -------------------------------------------------------------------------- */
/* 后端取数 (失败即空)                                                         */
/* -------------------------------------------------------------------------- */

/** 文章列表; withContent=true 时同时取回正文 (RSS / Atom 用) */
export async function fetchPosts(withContent = false): Promise<PostEntry[]> {
    const path = withContent ? "/public/posts?withContent=1" : "/public/posts";
    const result = await backendRequest<{ posts?: unknown[] }>(path, { timeoutMs: 6000 });
    if (!result.ok || !Array.isArray(result.data?.posts)) return [];
    return result.data.posts.map((item) => normalizePost(item));
}

/** 按 id / slug / routeName 取单篇文章 (含正文) */
export async function fetchPost(identifier: string): Promise<PostEntry | null> {
    const result = await backendRequest<{ post?: unknown }>(
        `/public/posts/${encodeURIComponent(identifier)}`,
        { timeoutMs: 6000 },
    );
    if (!result.ok || !result.data?.post) return null;
    return normalizePost(result.data.post);
}

/** 六个集合的完整目录树 (由后端文件系统直接生成) */
export async function fetchDirectoryTree<T>(): Promise<T[]> {
    const result = await backendRequest<{ tree?: unknown }>("/public/directory", { timeoutMs: 6000 });
    if (!result.ok || !Array.isArray(result.data?.tree)) return [];
    return result.data.tree as T[];
}

/** 某个集合的全部条目 (公开读取) */
export async function fetchCollectionEntries<T>(key: string): Promise<T[]> {
    const result = await backendRequest<{ entries?: unknown }>(
        `/public/collection/${encodeURIComponent(key)}`,
        { timeoutMs: 6000 },
    );
    if (!result.ok || !Array.isArray(result.data?.entries)) return [];
    return result.data.entries as T[];
}

/* -------------------------------------------------------------------------- */
/* 渲染                                                                        */
/* -------------------------------------------------------------------------- */

/** 把正文里的相对图片路径改写为后端资源接口的绝对地址 */
function rewriteRelativeAssetUrls(html: string, folderPath: string): string {
    const base = folderPath ? `${folderPath}/` : "";
    return html.replace(
        /(<img\b[^>]*?\bsrc=)(["'])(?!https?:|data:|\/\/|\/)([^"']*)\2/gi,
        (_match, prefix: string, quote: string, src: string) => {
            const target = `${base}${src}`.replace(/^\.\//, "");
            const absolute = `${getBackendBaseUrl()}/public/asset?collection=posts&path=${encodeURIComponent(target)}`;
            return `${prefix}${quote}${absolute}${quote}`;
        },
    );
}

/** 从渲染后的 HTML 中抽取标题, 供文章目录 (TOC) 使用 */
function extractHeadings(html: string): TocHeading[] {
    const root = parseHtml(html);
    const nodes = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const headings: TocHeading[] = [];
    for (const node of nodes) {
        const slug = node.getAttribute("id") || "";
        const text = node.textContent.trim();
        if (!slug || !text) continue;
        const depth = Number.parseInt(node.rawTagName.replace(/[^1-6]/g, ""), 10) || 1;
        headings.push({ depth, slug, text });
    }
    return headings;
}

/** 服务端渲染文章正文 (HTML 文章按原样注入, Markdown / MDX 走 markdown-it) */
export function renderPostEntry(entry: PostEntry): RenderedPost {
    const isHtml = entry.format === "html";
    const raw = isHtml ? extractHtmlBody(entry.body) : renderContent({ content: entry.body, format: entry.format });
    const html = rewriteRelativeAssetUrls(raw, entry.folderPath);
    return {
        html,
        headings: extractHeadings(html),
        frontmatter: entry.reading,
    };
}
