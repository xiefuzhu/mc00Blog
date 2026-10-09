/**
 * 控制台统一内容渲染器 (markdown / mdx / html)
 *
 * 目标: 在浏览器端尽量贴近站点真实排版管线
 *  - 站点: remark-math + rehype-katex / remark-directive + rehype-admonitions /
 *          rehype-callouts / remark-mermaid + rehype-mermaid / rehype-slug + autolink
 *  - 预览: markdown-it + katex + 同款 .admonition/.mermaid 标记 + highlight.js 着色
 *
 * 已知近似点 (无法在浏览器端 1:1 复刻的部分):
 *  - expressive-code 的折叠块、行号、终端标题栏
 *  - MDX 中的 JSX 组件本身 (按 Markdown 渲染, JSX 标签会被原样透出)
 */

import MarkdownIt from "markdown-it";
import katex from "katex";

import type { ContentFormat } from "./types";

export interface PreviewPayload {
    content: string;
    format: ContentFormat;
}

/* -------------------------------------------------------------------------- */
/* 基础工具                                                                    */
/* -------------------------------------------------------------------------- */

function escapeHtml(value: string): string {
    return (value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
    return escapeHtml(value).replace(/'/g, "&#39;");
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/** 与 rehype-slug (github-slugger) 基本一致的标题锚点生成 */
function slugifyHeading(text: string): string {
    return (text || "")
        .trim()
        .toLowerCase()
        .replace(/[\s]+/g, "-")
        .replace(/[^\p{L}\p{N}\-_]/gu, "")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "");
}

/* -------------------------------------------------------------------------- */
/* markdown-it 扩展: 公式 / 任务列表 / 标题锚点                                */
/* -------------------------------------------------------------------------- */

function mathPlugin(md: MarkdownIt): void {
    // 行内公式 $...$
    md.inline.ruler.after("escape", "math_inline", (state: any, silent: boolean) => {
        const start = state.pos;
        if (state.src[start] !== "$" || state.src[start + 1] === "$") return false;
        let cursor = start + 1;
        let end = -1;
        while (cursor < state.posMax) {
            if (state.src[cursor] === "\\") {
                cursor += 2;
                continue;
            }
            if (state.src[cursor] === "$") {
                end = cursor;
                break;
            }
            cursor += 1;
        }
        if (end < 0) return false;
        const content = state.src.slice(start + 1, end);
        if (!content.trim() || content.includes("\n")) return false;
        if (!silent) {
            const token = state.push("math_inline", "math", 0);
            token.content = content;
        }
        state.pos = end + 1;
        return true;
    });

    md.renderer.rules.math_inline = (tokens: any[], idx: number) => {
        const token = tokens[idx];
        try {
            return katex.renderToString(token.content, { displayMode: false, throwOnError: false });
        } catch {
            return `<code>${escapeHtml(token.content)}</code>`;
        }
    };

    // 块级公式 $$...$$
    md.block.ruler.before("fence", "math_block", (state: any, startLine: number, endLine: number, silent: boolean) => {
        const start = state.bMarks[startLine] + state.tShift[startLine];
        const max = state.eMarks[startLine];
        const line = state.src.slice(start, max).trim();
        if (!line.startsWith("$$")) return false;

        // 单行写法 $$x$$
        if (line.length > 4 && line.endsWith("$$")) {
            if (silent) return true;
            const token = state.push("math_block", "math", 0);
            token.content = line.slice(2, -2).trim();
            token.map = [startLine, startLine + 1];
            state.line = startLine + 1;
            return true;
        }
        if (line !== "$$") return false;
        if (silent) return true;

        let nextLine = startLine + 1;
        const collected: string[] = [];
        let closed = false;
        while (nextLine < endLine) {
            const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
            const lineEnd = state.eMarks[nextLine];
            const text = state.src.slice(lineStart, lineEnd);
            if (text.trim() === "$$") {
                closed = true;
                break;
            }
            collected.push(text);
            nextLine += 1;
        }
        if (!closed) return false;

        const token = state.push("math_block", "math", 0);
        token.content = collected.join("\n").trim();
        token.map = [startLine, nextLine + 1];
        state.line = nextLine + 1;
        return true;
    });

    md.renderer.rules.math_block = (tokens: any[], idx: number) => {
        const token = tokens[idx];
        try {
            return `<div class="console-math-block">${katex.renderToString(token.content, { displayMode: true, throwOnError: false })}</div>`;
        } catch {
            return `<pre class="console-math-fallback">${escapeHtml(token.content)}</pre>`;
        }
    };
}

function taskListPlugin(md: MarkdownIt): void {
    md.core.ruler.after("inline", "console_task_list", (state: any) => {
        const tokens: any[] = state.tokens;
        for (let index = 0; index < tokens.length; index += 1) {
            const token = tokens[index];
            if (token.type !== "inline") continue;
            if (index < 2) continue;
            const paragraphOpen = tokens[index - 1];
            const listItemOpen = tokens[index - 2];
            if (paragraphOpen?.type !== "paragraph_open" || listItemOpen?.type !== "list_item_open") continue;

            const match = /^\[([ xX])\]\s+([\s\S]*)$/.exec(token.content);
            if (!match) continue;

            const checked = match[1].toLowerCase() === "x";
            token.content = match[2];
            token.children = [];
            state.md.inline.parse(token.content, state.md, state.env, token.children);
            listItemOpen.attrJoin("class", "task-list-item");
            listItemOpen.meta = { ...(listItemOpen.meta || {}), taskChecked: checked };
        }
    });

    const defaultListItemOpen = md.renderer.rules.list_item_open;
    md.renderer.rules.list_item_open = (tokens: any[], idx: number, options: any, env: any, self: any) => {
        const rendered = defaultListItemOpen
            ? defaultListItemOpen(tokens, idx, options, env, self)
            : self.renderToken(tokens, idx, options);
        const meta = tokens[idx].meta as { taskChecked?: boolean } | undefined;
        if (meta && typeof meta.taskChecked === "boolean") {
            const checkbox = `<input type="checkbox" disabled${meta.taskChecked ? " checked" : ""} class="console-task-checkbox" />`;
            return rendered.replace(/^<li([^>]*)>/, `<li$1>${checkbox}`);
        }
        return rendered;
    };
}

function headingAnchorPlugin(md: MarkdownIt): void {
    const used = new Map<string, number>();

    md.renderer.rules.heading_open = (tokens: any[], idx: number, options: any, _env: any, self: any) => {
        const inlineToken = tokens[idx + 1];
        const rawText = inlineToken?.content || "";
        let slug = slugifyHeading(rawText) || "section";
        const seen = used.get(slug);
        if (seen !== undefined) {
            used.set(slug, seen + 1);
            slug = `${slug}-${seen}`;
        } else {
            used.set(slug, 1);
        }
        tokens[idx].attrSet("id", slug);
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.heading_close = (tokens: any[], idx: number, options: any, _env: any, self: any) => {
        const openToken = tokens[idx - 1];
        const id = typeof openToken?.attrGet === "function" ? openToken.attrGet("id") : null;
        const anchor = id
            ? `<a class="anchor" href="#${escapeAttr(id)}" aria-hidden="true"><span class="anchor-icon">#</span></a>`
            : "";
        return `${anchor}${self.renderToken(tokens, idx, options)}`;
    };
}

/* -------------------------------------------------------------------------- */
/* 预处理器: :::tip 指令块 与 GitHub 风格 callout                              */
/* -------------------------------------------------------------------------- */

const ADMONITION_TYPES = "note|tip|important|warning|caution|info";

function admonitionMarkup(type: string, title: string, body: string): string {
    const normalized = type === "info" ? "note" : type;
    return [
        "",
        `<blockquote class="admonition bdm-${normalized}" data-callout="${normalized}">`,
        `<div class="bdm-title">${escapeHtml(title)}</div>`,
        "",
        body,
        "",
        "</blockquote>",
        "",
    ].join("\n");
}

function preprocessAdmonitions(content: string): string {
    // :::tip 标题 / :::tip[标题]
    const directiveRe = new RegExp(
        `^:::(${ADMONITION_TYPES})[ \\t]*(\\[[^\\]]*\\])?[ \\t]*\\n([\\s\\S]*?)^:::[ \\t]*$`,
        "gm",
    );
    let output = content.replace(directiveRe, (_match, type: string, label: string | undefined, body: string) => {
        const title = label ? label.slice(1, -1).trim() : capitalize(type);
        return admonitionMarkup(type, title, body.trim());
    });

    // GitHub 风格 > [!NOTE]
    output = output.replace(
        /^>[ \t]*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][^\n]*\n((?:>[^\n]*\n?)*)/gim,
        (_match, type: string, rest: string) => {
            const body = rest
                .split("\n")
                .map((line: string) => line.replace(/^>[ \t]?/, ""))
                .join("\n")
                .trim();
            return admonitionMarkup(type.toLowerCase(), capitalize(type.toLowerCase()), body);
        },
    );

    return output;
}

/* -------------------------------------------------------------------------- */
/* 渲染器                                                                      */
/* -------------------------------------------------------------------------- */

function createMarkdownRenderer(): MarkdownIt {
    const md = new MarkdownIt({
        html: true,
        linkify: true,
        breaks: false,
        typographer: false,
    });

    mathPlugin(md);
    taskListPlugin(md);
    headingAnchorPlugin(md);

    // 代码块与 mermaid 围栏 (覆盖默认 fence 渲染, 以输出站点风格外壳)
    md.renderer.rules.fence = (tokens: any[], idx: number) => {
        const token = tokens[idx];
        const info = token.info ? String(token.info).trim().split(/\s+/)[0] : "";
        const code = token.content.replace(/\n$/, "");

        if (info === "mermaid") {
            return [
                '<div class="mermaid-diagram-container">',
                '<div class="mermaid-wrapper">',
                `<div class="mermaid" data-mermaid-code="${escapeAttr(code)}">${escapeHtml(code)}</div>`,
                "</div>",
                "</div>",
            ].join("");
        }

        const language = info || "text";
        return [
            `<figure class="console-code" data-language="${escapeAttr(language)}">`,
            `<figcaption class="console-code-bar"><span class="console-code-lang">${escapeHtml(language)}</span></figcaption>`,
            `<pre class="console-code-pre"><code class="language-${escapeAttr(language)}">${escapeHtml(code)}</code></pre>`,
            "</figure>",
        ].join("");
    };

    // 图片: 与站点一致开启懒加载与点击放大光标
    const defaultImage = md.renderer.rules.image;
    md.renderer.rules.image = (tokens: any[], idx: number, options: any, env: any, self: any) => {
        tokens[idx].attrSet("loading", "lazy");
        return defaultImage
            ? defaultImage(tokens, idx, options, env, self)
            : self.renderToken(tokens, idx, options);
    };

    return md;
}

let renderer: MarkdownIt | null = null;

function getRenderer(): MarkdownIt {
    if (!renderer) {
        renderer = createMarkdownRenderer();
    }
    return renderer;
}

/**
 * 渲染正文为 HTML
 * html 格式直接返回原文, 由调用方决定放进沙箱 iframe 还是直接注入
 */
export function renderContent(payload: PreviewPayload): string {
    const content = payload.content || "";
    if (!content.trim()) return "";
    if (payload.format === "html") return content;
    return getRenderer().render(preprocessAdmonitions(content));
}

/* -------------------------------------------------------------------------- */
/* 样式与懒加载资源                                                            */
/* -------------------------------------------------------------------------- */

const PREVIEW_STYLE_ID = "console-preview-style";

const PREVIEW_CSS = `
.console-preview-body { line-height: 1.75; }
.console-preview-body .console-math-block { margin: 1rem 0; overflow-x: auto; }
.console-preview-body .console-code {
  margin: 1rem 0; border-radius: 0.75rem; overflow: hidden;
  border: 1px solid color-mix(in oklch, var(--line-divider) 100%, transparent);
  background-color: var(--codeblock-bg);
}
.console-preview-body .console-code-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.375rem 0.75rem; font-size: 0.7rem; letter-spacing: 0.04em;
  background-color: var(--codeblock-topbar-bg); color: var(--content-meta);
  font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
}
.console-preview-body .console-code-pre { margin: 0; padding: 0.9rem 1rem; overflow-x: auto; }
.console-preview-body .console-code-pre code {
  font-family: 'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.813rem; line-height: 1.6; color: inherit; background: none; padding: 0;
}
.console-preview-body .console-task-checkbox {
  margin-right: 0.5rem; vertical-align: middle; accent-color: var(--primary);
}
.console-preview-body .task-list-item { list-style: none; margin-left: -1rem; }
.console-preview-body .mermaid-diagram-container { margin: 1rem 0; overflow-x: auto; }
.console-preview-body .mermaid { min-height: 60px; display: flex; justify-content: center; }
.console-preview-body .console-mermaid-error {
  padding: 0.75rem 1rem; border-radius: 0.75rem; font-size: 0.75rem;
  border: 1px dashed #f43f5e; color: #e11d48;
}
.console-preview-body .hljs-comment, .console-preview-body .hljs-quote { color: #8b949e; font-style: italic; }
.console-preview-body .hljs-keyword, .console-preview-body .hljs-selector-tag,
.console-preview-body .hljs-literal, .console-preview-body .hljs-doctag { color: var(--primary); font-weight: 600; }
.console-preview-body .hljs-string, .console-preview-body .hljs-regexp,
.console-preview-body .hljs-attribute, .console-preview-body .hljs-addition { color: #059669; }
:root.dark .console-preview-body .hljs-string, :root.dark .console-preview-body .hljs-regexp,
:root.dark .console-preview-body .hljs-attribute, :root.dark .console-preview-body .hljs-addition { color: #4ade80; }
.console-preview-body .hljs-number, .console-preview-body .hljs-built_in,
.console-preview-body .hljs-type, .console-preview-body .hljs-symbol { color: #d97706; }
:root.dark .console-preview-body .hljs-number, :root.dark .console-preview-body .hljs-built_in,
:root.dark .console-preview-body .hljs-type, :root.dark .console-preview-body .hljs-symbol { color: #fbbf24; }
.console-preview-body .hljs-title, .console-preview-body .hljs-section,
.console-preview-body .hljs-name, .console-preview-body .hljs-function { color: #2563eb; }
:root.dark .console-preview-body .hljs-title, :root.dark .console-preview-body .hljs-section,
:root.dark .console-preview-body .hljs-name, :root.dark .console-preview-body .hljs-function { color: #93c5fd; }
.console-preview-body .hljs-deletion, .console-preview-body .hljs-meta { color: #dc2626; }
.console-preview-body .hljs-emphasis { font-style: italic; }
.console-preview-body .hljs-strong { font-weight: 700; }
`;

export function ensurePreviewStyles(): void {
    if (typeof document === "undefined") return;
    if (document.getElementById(PREVIEW_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = PREVIEW_STYLE_ID;
    style.textContent = PREVIEW_CSS;
    document.head.appendChild(style);
}

let highlightPromise: Promise<any> | null = null;

function loadHighlightJs(): Promise<any> {
    if (typeof window === "undefined") return Promise.resolve(null);
    const exist = (window as any).hljs;
    if (exist) return Promise.resolve(exist);
    if (!highlightPromise) {
        highlightPromise = new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "/assets/js/highlight.min.js";
            script.async = true;
            script.onload = () => resolve((window as any).hljs || null);
            script.onerror = () => resolve(null);
            document.head.appendChild(script);
        });
    }
    return highlightPromise;
}

const MERMAID_SOURCES = [
    "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js",
    "https://unpkg.com/mermaid@11/dist/mermaid.min.js",
];

let mermaidPromise: Promise<any> | null = null;

function loadMermaid(): Promise<any> {
    if (typeof window === "undefined") return Promise.resolve(null);
    const exist = (window as any).mermaid;
    if (exist) return Promise.resolve(exist);
    if (!mermaidPromise) {
        mermaidPromise = new Promise((resolve) => {
            let index = 0;
            const attempt = () => {
                if (index >= MERMAID_SOURCES.length) {
                    resolve(null);
                    return;
                }
                const script = document.createElement("script");
                script.src = MERMAID_SOURCES[index];
                script.async = true;
                script.onload = () => resolve((window as any).mermaid || null);
                script.onerror = () => {
                    index += 1;
                    attempt();
                };
                document.head.appendChild(script);
            };
            attempt();
        });
    }
    return mermaidPromise;
}

/** 代码高亮 (highlight.js 按需加载, 加载失败时保持纯文本) */
export async function highlightCodeBlocks(root: HTMLElement): Promise<void> {
    const blocks = root.querySelectorAll<HTMLElement>("pre code[class*='language-']");
    if (blocks.length === 0 || root.querySelector(".hljs")) return;
    const hljs = await loadHighlightJs();
    if (!hljs) return;
    for (const block of Array.from(blocks)) {
        try {
            hljs.highlightElement(block);
        } catch {
            // 忽略单个代码块的高亮失败
        }
    }
}

/** mermaid 图表渲染 (与站点一致使用 CDN 版 mermaid v11) */
export async function renderMermaidDiagrams(root: HTMLElement, force = false): Promise<void> {
    const nodes = root.querySelectorAll<HTMLElement>(".mermaid[data-mermaid-code]");
    if (nodes.length === 0) return;
    const mermaid = await loadMermaid();
    if (!mermaid) return;

    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    try {
        mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? "dark" : "default",
            securityLevel: "loose",
            fontFamily: "inherit",
        });
    } catch {
        // 初始化失败时仍尝试渲染
    }

    for (const node of Array.from(nodes)) {
        if (node.dataset.rendered === "1" && !force) continue;
        const code = node.getAttribute("data-mermaid-code") || "";
        if (!code.trim()) continue;
        try {
            const id = `console-mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const result = await mermaid.render(id, code);
            node.innerHTML = result.svg;
            node.dataset.rendered = "1";
            const svg = node.querySelector("svg");
            if (svg) {
                svg.setAttribute("width", "100%");
                svg.removeAttribute("height");
                (svg as SVGElement).style.maxWidth = "100%";
                (svg as SVGElement).style.height = "auto";
            }
        } catch {
            node.dataset.rendered = "error";
            node.innerHTML = '<div class="console-mermaid-error">Mermaid 图表语法解析失败，请检查源码</div>';
        }
    }
}

/** 内容水合: 代码高亮 + mermaid 渲染 */
export async function hydratePreview(root: HTMLElement): Promise<void> {
    await Promise.all([highlightCodeBlocks(root), renderMermaidDiagrams(root)]);
}

/* -------------------------------------------------------------------------- */
/* HTML 格式: 沙箱文档构造                                                     */
/* -------------------------------------------------------------------------- */

/** 取完整 HTML 文档的 <body> 内容 (与站点 HTML loader 行为一致) */
export function extractHtmlBody(content: string): string {
    const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(content || "");
    if (bodyMatch) return bodyMatch[1];
    if (/<html[\s>]/i.test(content || "")) {
        return (content || "")
            .replace(/<!doctype[^>]*>/gi, "")
            .replace(/<head[\s\S]*?<\/head>/gi, "")
            .replace(/<\/?html[^>]*>/gi, "")
            .replace(/<\/?body[^>]*>/gi, "");
    }
    return content || "";
}

/** 收集当前页面的样式表, 让沙箱 iframe 拥有与站点一致的排版基底 */
function collectHeadMarkup(): string {
    if (typeof document === "undefined") return "";
    const nodes = document.querySelectorAll('link[rel="stylesheet"], style');
    return Array.from(nodes)
        .map((node) => node.outerHTML)
        .join("\n");
}

/**
 * 构造 HTML 文章的沙箱文档
 * mode = "styled": 套用站点文章排版 (custom-md + prose)
 * mode = "raw": 原样渲染作者提供的 HTML
 */
export function buildSandboxDocument(
    content: string,
    options: { dark?: boolean; mode?: "styled" | "raw" } = {},
): string {
    const mode = options.mode ?? "styled";
    const dark = options.dark ?? false;
    const head = collectHeadMarkup();
    const themeClass = dark ? "dark" : "";

    if (mode === "raw") {
        const raw = /<html[\s>]/i.test(content || "")
            ? (content || "").replace(/<html([^>]*)>/i, `<html$1 class="${themeClass}">`)
            : `<!doctype html><html class="${themeClass}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body>${content || ""}</body></html>`;
        return raw;
    }

    const body = extractHtmlBody(content || "");
    return [
        "<!doctype html>",
        `<html class="${themeClass}">`,
        '<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />',
        head,
        "<style>html,body{margin:0;padding:0;background:transparent;}body{padding:1.25rem;}",
        "a{color:var(--primary);}</style>",
        "</head>",
        '<body class="console-preview-body custom-md prose dark:prose-invert max-w-none">',
        body,
        "</body></html>",
    ].join("\n");
}

/* -------------------------------------------------------------------------- */
/* 整页预览: sessionStorage 传递 + 新标签页打开                                 */
/* -------------------------------------------------------------------------- */

export interface ConsolePreviewPayload {
    title: string;
    slug: string;
    format: ContentFormat;
    content: string;
    summary?: string;
    cover?: string;
    status?: string;
    categories?: string[];
    tags?: string[];
    author?: string;
    createdAt?: string;
    updatedAt?: string;
    wordCount?: number;
    readingTime?: number;
    folderPath?: string;
}

export const PREVIEW_STORAGE_KEY = "mc00_console_preview";

/** 稿件在 localStorage 中的键前缀 (URL 通过 ?draft=<key> 指过来) */
const PREVIEW_DRAFT_PREFIX = "mc00_preview_draft_";
/** 最多保留的稿件份数, 超出时按时间淘汰最旧的 */
const PREVIEW_DRAFT_KEEP = 5;

function previewRouteUrl(draftKey?: string): string {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const route = `${base}/console/preview/`;
    return draftKey ? `${route}?draft=${encodeURIComponent(draftKey)}` : route;
}

function pruneDraftPayloads(): void {
    try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key && key.startsWith(PREVIEW_DRAFT_PREFIX)) keys.push(key);
        }
        // 键里带时间戳, 字典序即时间序
        keys.sort();
        while (keys.length > PREVIEW_DRAFT_KEEP) {
            const oldest = keys.shift();
            if (oldest) localStorage.removeItem(oldest);
        }
    } catch {
        // 忽略存储异常
    }
}

/**
 * 打开整页预览。
 *
 * 稿件传递方式: 写入 localStorage 并把 key 放到 URL 上 (?draft=...)。
 * 不能只依赖 sessionStorage —— 新标签页在 opener 被切断 (浏览器策略 / 扩展 / 隐私设置)
 * 时不会复制 sessionStorage, 预览页就会读到空稿件。localStorage 与标签页无关, 可靠得多;
 * sessionStorage 仅作为同标签页刷新时的兜底保留。
 */
export function openConsolePreview(payload: ConsolePreviewPayload): void {
    if (typeof window === "undefined") return;
    const json = JSON.stringify(payload);

    let draftKey: string | undefined;
    try {
        draftKey = `${PREVIEW_DRAFT_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem(draftKey, json);
        pruneDraftPayloads();
    } catch {
        draftKey = undefined;
    }

    try {
        sessionStorage.setItem(PREVIEW_STORAGE_KEY, json);
    } catch {
        // 忽略存储异常
    }

    window.open(previewRouteUrl(draftKey), "_blank");
}

/** 读取待预览稿件 (优先 URL 上的 draft key, 退回 sessionStorage) */
export function readConsolePreview(): ConsolePreviewPayload | null {
    if (typeof window === "undefined") return null;

    try {
        const draftKey = new URLSearchParams(window.location.search).get("draft");
        if (draftKey && draftKey.startsWith(PREVIEW_DRAFT_PREFIX)) {
            const raw = localStorage.getItem(draftKey);
            if (raw) return JSON.parse(raw) as ConsolePreviewPayload;
        }
    } catch {
        // 继续尝试 sessionStorage
    }

    try {
        const raw = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as ConsolePreviewPayload) : null;
    } catch {
        return null;
    }
}

/* -------------------------------------------------------------------------- */
/* 控制器                                                                      */
/* -------------------------------------------------------------------------- */

export interface PreviewController {
    update(next: PreviewPayload): void;
    refresh(): void;
    destroy(): void;
}

/**
 * 把一个容器变成实时预览面板 (内容变更去抖重绘, 并重新水合代码与图表)
 */
export function createPreview(element: HTMLElement, initial: PreviewPayload): PreviewController {
    ensurePreviewStyles();
    let payload: PreviewPayload = initial;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let paintToken = 0;

    const paint = async () => {
        if (disposed) return;
        const token = ++paintToken;
        element.innerHTML = renderContent(payload);
        await hydratePreview(element);
        if (token !== paintToken) return;
    };

    const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            void paint();
        }, 200);
    };

    void paint();

    return {
        update(next: PreviewPayload) {
            payload = next;
            schedule();
        },
        refresh() {
            void paint();
        },
        destroy() {
            disposed = true;
            if (timer) clearTimeout(timer);
        },
    };
}
