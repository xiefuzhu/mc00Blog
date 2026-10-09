/**
 * Markdown 渲染与 Astro 格式导出工具
 * 规范：绝对禁止输出任何 Emoji 表情符号
 */

import type { ContentFormat, Post } from "./types";

export const CONTENT_FORMAT_EXTENSION: Record<ContentFormat, string> = {
    markdown: "md",
    mdx: "mdx",
    html: "html",
};

export const CONTENT_FORMAT_LABEL: Record<ContentFormat, string> = {
    markdown: "Markdown",
    mdx: "MDX",
    html: "HTML",
};

/** 归一化格式取值 */
export function normalizeContentFormat(format?: string | null): ContentFormat {
    if (format === "html" || format === "mdx") return format;
    return "markdown";
}

export function insertFormatting(
    textarea: HTMLTextAreaElement | null,
    prefix: string,
    suffix = "",
    placeholder = "示例文本"
): string | null {
    if (!textarea) return null;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const selectedText = text.substring(start, end) || placeholder;
    const replacement = prefix + selectedText + suffix;

    textarea.value = text.substring(0, start) + replacement + text.substring(end);
    textarea.focus();
    textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length
    );

    return textarea.value;
}

/**
 * 统计字数
 */
export function countWords(text: string): number {
    if (!text) return 0;
    // 统计中文字符与英文字词
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.replace(/[\u4e00-\u9fa5]/g, " ").match(/[a-zA-Z0-9_-]+/g) || []).length;
    return chineseChars + englishWords;
}

/**
 * 估算阅读时间（分钟）
 */
export function getReadingTime(text: string): number {
    const words = countWords(text);
    return Math.max(1, Math.ceil(words / 300));
}

/**
 * 将 Post 转换为可落库的稿件文件 (按格式产出 .md / .mdx / .html)
 * 文件名与目录层级与 src/content/posts 一致, 便于直接放入内容目录
 */
export interface ExportedPostFile {
    /** 浏览器下载用的文件名 (不含目录) */
    filename: string;
    /** 相对 src/content/posts 的目标路径, 例如 guide/getting-started.md */
    path: string;
    content: string;
}

/**
 * 文章编辑器会写出的 frontmatter 字段。
 * 写回真实文件时, 这些字段由编辑器负责; 其余字段 (copyProtection、encrypted、
 * password、coverInContent 等) 由服务端从原文件保留, 避免保存时丢字段。
 */
export const MANAGED_FRONTMATTER_KEYS = [
    "title",
    "published",
    "description",
    "cover",
    "tags",
    "category",
    "draft",
    "pinned",
];

export function exportPostFile(
    post: Post,
    format: ContentFormat = "markdown",
    categoriesMap?: Map<string, string>,
    tagsMap?: Map<string, string>,
): ExportedPostFile {
    const publishedDate = post.createdAt ? post.createdAt.split("T")[0] : new Date().toISOString().split("T")[0];
    const categoryNames = post.categories.map((c) => (categoriesMap?.get(c) || c));
    const tagNames = post.tags.map((t) => (tagsMap?.get(t) || t));

    const categoryList = categoryNames.length > 0
        ? `\n  - ${categoryNames.map(c => `"${c}"`).join("\n  - ")}`
        : " []";
    const tagList = tagNames.length > 0
        ? `\n  - ${tagNames.map(t => `"${t}"`).join("\n  - ")}`
        : " []";

    const frontmatter = `---
title: "${post.title.replace(/"/g, '\\"')}"
published: ${publishedDate}
description: "${(post.summary || post.excerpt || '').replace(/"/g, '\\"')}"
${post.cover ? `cover: "${post.cover}"\n` : ''}tags:${tagList}
category:${categoryList}
draft: ${post.status !== 'published'}
pinned: ${post.pinned ? 'true' : 'false'}
---

`;

    const extension = CONTENT_FORMAT_EXTENSION[normalizeContentFormat(format)];
    const slug = (post.slug || "untitled").replace(/^\/+|\/+$/g, "");
    const folderPath = (post.folderPath || "").replace(/^\/+|\/+$/g, "");
    const filename = `${slug}.${extension}`;

    return {
        filename,
        path: folderPath ? `${folderPath}/${filename}` : filename,
        content: `${frontmatter}${post.content || ""}\n`,
    };
}

/**
 * 兼容旧调用: 默认导出 Markdown 文本
 */
export function exportAstroMarkdown(
    post: Post,
    categoriesMap?: Map<string, string>,
    tagsMap?: Map<string, string>,
): string {
    return exportPostFile(post, "markdown", categoriesMap, tagsMap).content;
}

/**
 * 浏览器端下载文本文件为 .md
 */
export function downloadTextFile(filename: string, content: string): void {
    if (typeof window === "undefined") return;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
