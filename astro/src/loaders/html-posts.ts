/**
 * HTML 文章内容 loader
 * ---------------------------------------------------------------------------
 * 站点内容集合 posts 默认只匹配 .md / .mdx。为了让内容目录里的 .html 文件也成为
 * 一等公民（出现在首页「目录」面板、归档、RSS、sitemap 与文章详情页中），这里提供
 * 一个自定义 loader：读取 src/content/posts 下的 .html / .htm 文件，解析文件顶部
 * 的 `---` frontmatter，并把正文（HTML）交给 Astro 数据层。
 *
 * 为什么不直接用 Astro 内置的 glob()
 * ---------------------------------------------------------------------------
 * glob() 依据 entryTypes（由扩展名推导）选择解析器，而 Astro 内置的 entry type 只有
 * .md / .mdx / .json / .yaml / .yml。命中 .html 时 configForFile() 返回 undefined，
 * 于是打印 "No entry type found" 并跳过该文件。所以扩展名到数据的解析必须自己做。
 *
 * 关键契约（已核对 astro@5.18.2 源码）
 * ---------------------------------------------------------------------------
 * 1. astro/dist/content/runtime.js 的 render(entry) 会优先使用 entry.rendered.html，
 *    并把 entry.rendered.metadata.headings / .frontmatter 分别作为 headings 与
 *    remarkPluginFrontmatter 返回。因此这里必须自己算好 headings（TOC 锚点用）与
 *    words / minutes / excerpt（字数、阅读时间、摘要用），才能与 Markdown 文章在
 *    界面上表现一致。
 * 2. ID 生成规则与 glob() 的默认实现保持一致：对相对路径分段做 github-slugger 的
 *    slug 再拼回 "/"，并去掉结尾的 /index。这样 .html 文章的 URL 与目录树分组同 .md
 *    完全同构（例如 guide/Getting Started.html → guide/getting-started）。
 * 3. store.set() 要求 filePath 是相对站点根目录的 posix 路径（不能以 "/" 开头）。
 * 4. 清理职责：glob() 会在 load 结束时删除「本次未被触碰」的条目（用于源文件被删除
 *    的场景）。本 loader 不自行清理，统一交给 content.config.ts 里的组合 loader 收尾
 *    —— 否则两个 loader 会互相删掉对方写入的条目。
 */

import { promises as fs } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { slug as githubSlug, default as GithubSlugger } from "github-slugger";
import { load as parseYaml } from "js-yaml";
import { parse as parseHtml } from "node-html-parser";
import getReadingTime from "reading-time";
import type { Loader, LoaderContext } from "astro/loaders";

/** 支持的 HTML 扩展名（与 utils/url.ts 的 removeFileExtension 保持一致） */
export const HTML_EXTENSIONS = [".html", ".htm"];

const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";

/** 文件顶部的 frontmatter 块（必须位于文件最开头） */
const FRONTMATTER_PATTERN = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

interface HtmlPostsOptions {
    /** 内容目录，相对站点根目录，默认 ./src/content/posts */
    base?: string;
}

function isHtmlFileName(name: string): boolean {
    const lower = name.toLowerCase();
    return HTML_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function toPosix(value: string): string {
    return value.split(sep).join("/");
}

/** 目录遍历：收集所有 HTML 文件（跳过以 "_" 开头的文件，与 md 的 glob 规则一致） */
async function collectHtmlFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collectHtmlFiles(fullPath)));
        } else if (entry.isFile() && isHtmlFileName(entry.name) && !entry.name.startsWith("_")) {
            files.push(fullPath);
        }
    }
    return files;
}

/** 去掉扩展名并做与 glob() 一致的 slug 化，得到内容条目 id */
function generateId(relativePosixPath: string): string {
    const withoutExt = relativePosixPath.replace(/\.[^./]+$/, "");
    return withoutExt
        .split("/")
        .map((segment) => githubSlug(segment))
        .join("/")
        .replace(/\/index$/, "");
}

/**
 * 把文件内容拆成 frontmatter 数据与 HTML 正文。
 * 若正文是一份完整文档（含 <html> / <body>），只取 <body> 的内容，
 * 避免把 <head> / <style> 之类塞进文章正文。
 */
function splitDocument(contents: string): { data: Record<string, unknown>; body: string } {
    let data: Record<string, unknown> = {};
    let rest = contents;

    const matched = contents.match(FRONTMATTER_PATTERN);
    if (matched) {
        rest = contents.slice(matched[0].length);
        try {
            const parsed = parseYaml(matched[1]);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                data = parsed as Record<string, unknown>;
            }
        } catch (error) {
            throw new Error(
                `HTML 文章的 frontmatter 不是合法 YAML: ${(error as Error).message}`,
            );
        }
    }

    const looksLikeFullDocument = /<html[\s>]/i.test(rest) || /<body[\s>]/i.test(rest);
    if (!looksLikeFullDocument) {
        return { data, body: rest };
    }

    const document = parseHtml(rest);
    const bodyElement = document.querySelector("body");
    return { data, body: bodyElement ? bodyElement.innerHTML : rest };
}

/**
 * 为标题注入 id（TOC 锚点）并收集 headings。
 * 正文里没有任何标题时返回原始 HTML，避免 node-html-parser 的重新序列化影响到
 * 用户手写的 HTML。
 */
function applyHeadings(bodyHtml: string): {
    html: string;
    headings: { depth: number; slug: string; text: string }[];
} {
    if (!/<h[1-6][\s>]/i.test(bodyHtml)) {
        return { html: bodyHtml, headings: [] };
    }

    const root = parseHtml(bodyHtml);
    const slugger = new GithubSlugger();
    const headings: { depth: number; slug: string; text: string }[] = [];
    let injectedId = false;

    for (const element of root.querySelectorAll(HEADING_SELECTOR)) {
        const text = element.textContent.trim();
        if (!text) continue;

        const existingId = element.getAttribute("id");
        const slug = existingId || slugger.slug(text);
        if (!existingId) {
            element.setAttribute("id", slug);
            injectedId = true;
        }

        headings.push({
            depth: Number(element.tagName.replace(/^H/i, "")),
            slug,
            text,
        });
    }

    if (headings.length === 0) {
        return { html: bodyHtml, headings: [] };
    }

    // 所有标题本来就带 id 时无需回写，保持原始 HTML 不变
    return { html: injectedId ? root.toString() : bodyHtml, headings };
}

/** 汇总预览所需的元数据：字数 / 阅读时间 / 首段摘要 */
function buildFrontmatterMetadata(
    plainText: string,
    firstParagraph: string,
): Record<string, unknown> {
    const readingTime = getReadingTime(plainText);
    return {
        words: readingTime.words,
        minutes: Math.max(1, Math.round(readingTime.minutes)),
        excerpt: firstParagraph || plainText.slice(0, 160),
    };
}

export function htmlPosts({ base = "./src/content/posts" }: HtmlPostsOptions = {}): Loader {
    const fileToIdMap = new Map<string, string>();

    return {
        name: "html-posts-loader",
        load: async ({
            config,
            logger,
            watcher,
            parseData,
            store,
            generateDigest,
        }: LoaderContext) => {
            const siteRoot = fileURLToPath(config.root);
            const basePath = fileURLToPath(new URL(base, config.root));

            async function syncData(relativePosixPath: string, oldId?: string) {
                const filePath = resolve(basePath, relativePosixPath);
                const contents = await fs.readFile(filePath, "utf-8").catch((error) => {
                    logger.error(`Error reading ${relativePosixPath}: ${error.message}`);
                    return undefined;
                });
                if (contents === undefined) return;

                let body: string;
                let data: Record<string, unknown>;
                try {
                    ({ body, data } = splitDocument(contents));
                } catch (error) {
                    logger.error(`${relativePosixPath}: ${(error as Error).message}`);
                    return;
                }

                const id = generateId(relativePosixPath);
                if (oldId && oldId !== id) {
                    store.delete(oldId);
                }
                fileToIdMap.set(filePath, id);

                const digest = generateDigest(contents);
                const existingEntry = store.get(id);
                if (existingEntry && existingEntry.digest === digest && existingEntry.filePath) {
                    return;
                }

                const fileRelativeToRoot = toPosix(relative(siteRoot, filePath));
                const parsedData = await parseData({ id, data, filePath });

                const { html, headings } = applyHeadings(body);
                const document = parseHtml(html);
                const plainText = document.textContent.replace(/\s+/g, " ").trim();
                const firstParagraph = document.querySelector("p")?.textContent.trim() ?? "";

                store.set({
                    id,
                    data: parsedData,
                    body,
                    filePath: fileRelativeToRoot,
                    digest,
                    rendered: {
                        html,
                        metadata: {
                            headings,
                            frontmatter: buildFrontmatterMetadata(plainText, firstParagraph),
                        },
                    },
                });
            }

            for (const filePath of await collectHtmlFiles(basePath)) {
                await syncData(toPosix(relative(basePath, filePath)), fileToIdMap.get(filePath));
            }

            if (!watcher) return;
            watcher.add(basePath);

            const onChange = async (changedPath: string) => {
                const relativePosixPath = toPosix(relative(basePath, changedPath));
                if (
                    relativePosixPath.startsWith("..") ||
                    !isHtmlFileName(relativePosixPath) ||
                    relativePosixPath.split("/").some((part) => part.startsWith("_"))
                ) {
                    return;
                }
                await syncData(relativePosixPath, fileToIdMap.get(changedPath));
                logger.info(`Reloaded data from ${relativePosixPath}`);
            };

            watcher.on("change", onChange);
            watcher.on("add", onChange);
            watcher.on("unlink", async (deletedPath: string) => {
                const id = fileToIdMap.get(deletedPath);
                if (id) {
                    store.delete(id);
                    fileToIdMap.delete(deletedPath);
                }
            });
        },
    };
}
