/**
 * Markdown 渲染与 Astro 格式导出工具
 * 规范：绝对禁止输出任何 Emoji 表情符号
 */

import type { Post } from "./types";

export function renderMarkdown(md: string): string {
    if (!md) return "";

    let html = md
        // 过滤 frontmatter
        .replace(/^---[\s\S]*?---\n*/, "")
        // HTML 转义
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 代码块 (```code```)
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre class="bg-black/10 dark:bg-white/5 p-4 rounded-xl overflow-x-auto my-3 text-xs font-mono border border-black/5 dark:border-white/10"><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // 行内代码 (`code`)
    html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-xs font-mono text-(--primary)">$1</code>');

    // 提示块 (:::tip ... :::)
    html = html.replace(/:::(note|tip|important|warning|caution)\n([\s\S]*?):::/g, (_, type, content) => {
        const typeLabels: Record<string, string> = {
            note: "[备注]",
            tip: "[提示]",
            important: "[重点]",
            warning: "[警告]",
            caution: "[注意]",
        };
        return `<div class="my-3 p-3 rounded-xl border border-primary/30 bg-primary/5 text-xs">
            <div class="font-bold text-primary mb-1 text-[11px] uppercase tracking-wider">${typeLabels[type] || `[${type}]`}</div>
            <div class="leading-relaxed opacity-90">${content.trim().replace(/\n/g, "<br>")}</div>
        </div>`;
    });

    // 标题 (# h1, ## h2, ### h3, #### h4)
    html = html.replace(/^#### (.*$)/gim, '<h4 class="text-sm font-bold mt-4 mb-1.5 text-neutral-800 dark:text-neutral-100">$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-bold mt-5 mb-2 text-neutral-800 dark:text-neutral-100">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold mt-6 mb-2.5 pb-1 border-b border-black/5 dark:border-white/10 text-neutral-900 dark:text-neutral-50">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-black mt-6 mb-3 text-neutral-900 dark:text-neutral-50">$1</h1>');

    // 粗体与斜体
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-neutral-900 dark:text-neutral-100">$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
    html = html.replace(/~~([^~]+)~~/g, '<del class="line-through opacity-70">$1</del>');

    // 引用块 (> quote)
    html = html.replace(/^\> (.*$)/gim, '<blockquote class="border-l-3 border-(--primary) pl-3 py-1 my-2 text-xs italic opacity-85 text-neutral-700 dark:text-neutral-300 bg-black/2 dark:bg-white/2 rounded-r-md">$1</blockquote>');

    // 无序列表与任务列表
    html = html.replace(/^- \[ \] (.*$)/gim, '<li class="list-none flex items-center gap-1.5 text-xs my-0.5"><input type="checkbox" disabled class="accent-primary" /> <span>$1</span></li>');
    html = html.replace(/^- \[x\] (.*$)/gim, '<li class="list-none flex items-center gap-1.5 text-xs line-through opacity-70 my-0.5"><input type="checkbox" checked disabled class="accent-primary" /> <span>$1</span></li>');
    html = html.replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-xs my-0.5 leading-relaxed text-neutral-700 dark:text-neutral-300">$1</li>');

    // 表格简单替换 (若有)
    // 图片 ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl my-3 max-h-96 object-contain border border-black/10 dark:border-white/10 shadow-sm" />');

    // 链接 [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-(--primary) hover:underline font-medium underline-offset-2">$1</a>');

    // 分割线
    html = html.replace(/^---$/gim, '<hr class="my-4 border-black/10 dark:border-white/10" />');

    // 段落换行
    html = html.replace(/\n\n/g, '<div class="h-2.5"></div>');

    return html;
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
 * 将 Post 转换为标准 Astro Frontmatter Markdown 文本
 */
export function exportAstroMarkdown(
    post: Post,
    categoriesMap?: Map<string, string>,
    tagsMap?: Map<string, string>
): string {
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
${post.cover ? `image: "${post.cover}"\n` : ''}tags:${tagList}
category:${categoryList}
draft: ${post.status !== 'published'}
pinned: ${post.pinned ? 'true' : 'false'}
---

${post.content || ''}
`;

    return frontmatter;
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
