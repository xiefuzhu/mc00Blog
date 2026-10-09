/**
 * 服务端内容文件系统访问层
 *
 * 这是「真实写回仓库文件」的唯一实现处, 只允许被 src/pages/api/content/* 路由引用。
 * 所有对外暴露的路径解析都经过 resolveCollectionPath / resolveFolderPath 的白名单校验,
 * 确保只能操作 src/content/<collection> 目录内、且扩展名被允许的文件。
 */

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

import {
    SITE_COLLECTIONS,
    buildSiteDirectoryTree,
    getCollectionDefinition,
    type ContentSourceEntry,
    type SiteCollectionDefinition,
    type SiteCollectionKey,
    type SiteCollectionLabels,
    type SiteDirectoryNode,
    type SiteEntryFormat,
} from "@utils/contentCollections";
import { i18n } from "@i18n/translation";
import I18nKey from "@i18n/i18nKey";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** 仓库根目录 (src/server/ 向上两级) */
export const REPO_ROOT = path.resolve(HERE, "..", "..");
/** 站点内容根目录 */
export const CONTENT_ROOT = path.join(REPO_ROOT, "src", "content");

function toPosix(value: string): string {
    return value.replace(/\\/g, "/");
}

/** 写回能力是否开启 (本地开发, 或显式设置 CONSOLE_CONTENT_WRITE=1 的常驻 Node 服务) */
export function isContentWritable(): boolean {
    if (process.env.CONSOLE_CONTENT_WRITE === "1") return true;
    return import.meta.env.DEV === true;
}

export function isContentRootAvailable(): boolean {
    return existsSync(CONTENT_ROOT);
}

/** 当前环境是否允许真实写回 */
export function canWriteContent(): { writable: boolean; reason: string } {
    if (!isContentRootAvailable()) {
        return { writable: false, reason: "未找到 src/content 目录 (当前运行环境没有仓库文件系统)" };
    }
    if (process.env.CONSOLE_CONTENT_WRITE === "1") {
        return { writable: true, reason: "已通过 CONSOLE_CONTENT_WRITE=1 开启内容写回" };
    }
    if (import.meta.env.DEV === true) {
        return { writable: true, reason: "本地开发环境 (astro dev) 已开启内容写回" };
    }
    return {
        writable: false,
        reason: "静态/无状态部署没有仓库文件系统, 已降级为浏览与导出 (可设置 CONSOLE_CONTENT_WRITE=1 并部署常驻 Node 服务)",
    };
}

export function collectionLabels(): SiteCollectionLabels {
    const labels: SiteCollectionLabels = {};
    for (const def of SITE_COLLECTIONS) {
        labels[def.key] = i18n(def.i18nKey as I18nKey);
    }
    return labels;
}

/* -------------------------------------------------------------------------- */
/* 路径守卫                                                                    */
/* -------------------------------------------------------------------------- */

export type PathResolution =
    | { ok: true; abs: string; relPath: string; collection: SiteCollectionDefinition }
    | { ok: false; error: string };

function validateSegments(relPath: string): string | null {
    if (!relPath) return "路径不能为空";
    if (relPath.startsWith("/")) return "不允许绝对路径";
    if (/^[a-zA-Z]:/.test(relPath)) return "不允许盘符路径";
    const segments = relPath.split("/");
    if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
        return "路径包含非法片段";
    }
    return null;
}

/** 解析条目文件路径 (必须是集合允许的扩展名, 且落在集合根目录内) */
export function resolveEntryPath(collectionKey: string, rawRelPath: string): PathResolution {
    const collection = getCollectionDefinition(collectionKey);
    if (!collection) return { ok: false, error: `未知的内容集合: ${collectionKey}` };

    const relPath = toPosix(rawRelPath || "").replace(/^\.\//, "");
    const segmentError = validateSegments(relPath);
    if (segmentError) return { ok: false, error: segmentError };

    const ext = path.extname(relPath).toLowerCase();
    if (!collection.extensions.includes(ext)) {
        return { ok: false, error: `扩展名不被允许: ${ext || "(无扩展名)"}` };
    }

    const rootAbs = path.join(CONTENT_ROOT, collection.relRoot);
    const abs = path.resolve(rootAbs, relPath);
    if (!abs.startsWith(rootAbs + path.sep)) return { ok: false, error: "路径越界" };

    return { ok: true, abs, relPath, collection };
}

/** 解析文件夹路径 (无扩展名要求) */
export function resolveFolderPath(
    collectionKey: string,
    rawRelFolder: string,
    options: { allowRoot?: boolean } = {},
): PathResolution {
    const collection = getCollectionDefinition(collectionKey);
    if (!collection) return { ok: false, error: `未知的内容集合: ${collectionKey}` };

    const relPath = toPosix(rawRelFolder || "").replace(/^\.\//, "").replace(/\/+$/, "");
    if (!relPath) {
        if (!options.allowRoot) return { ok: false, error: "文件夹路径不能为空" };
        const rootAbs = path.join(CONTENT_ROOT, collection.relRoot);
        return { ok: true, abs: rootAbs, relPath: "", collection };
    }

    const segmentError = validateSegments(relPath);
    if (segmentError) return { ok: false, error: segmentError };

    const rootAbs = path.join(CONTENT_ROOT, collection.relRoot);
    const abs = path.resolve(rootAbs, relPath);
    if (!abs.startsWith(rootAbs + path.sep)) return { ok: false, error: "路径越界" };

    return { ok: true, abs, relPath, collection };
}

/* -------------------------------------------------------------------------- */
/* 文件读写                                                                    */
/* -------------------------------------------------------------------------- */

export async function readEntryFile(abs: string): Promise<string | null> {
    try {
        return await fs.readFile(abs, "utf-8");
    } catch {
        return null;
    }
}

export async function writeEntryFile(abs: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf-8");
}

export async function deleteEntryFile(abs: string): Promise<boolean> {
    try {
        await fs.unlink(abs);
        return true;
    } catch {
        return false;
    }
}

export async function moveEntryFile(fromAbs: string, toAbs: string, overwrite = false): Promise<void> {
    if (existsSync(toAbs) && !overwrite) {
        throw new Error("目标文件已存在");
    }
    await fs.mkdir(path.dirname(toAbs), { recursive: true });
    if (overwrite && existsSync(toAbs)) await fs.rm(toAbs, { force: true });
    await fs.rename(fromAbs, toAbs);
}

/* -------------------------------------------------------------------------- */
/* 文件夹操作                                                                  */
/* -------------------------------------------------------------------------- */

export async function createFolder(abs: string): Promise<void> {
    if (existsSync(abs)) throw new Error("同名文件夹已存在");
    await fs.mkdir(abs, { recursive: true });
}

export async function renameFolder(fromAbs: string, toAbs: string): Promise<void> {
    if (!existsSync(fromAbs)) throw new Error("源文件夹不存在");
    if (existsSync(toAbs)) throw new Error("目标文件夹已存在");
    await fs.mkdir(path.dirname(toAbs), { recursive: true });
    await fs.rename(fromAbs, toAbs);
}

/**
 * 删除文件夹。
 * keepEntries=true 时把文件夹内的直接子项整体上移一级 (保留名称, 遇到同名冲突则报错);
 * 否则连同内容一并删除。
 */
export async function deleteFolder(abs: string, keepEntries: boolean): Promise<void> {
    if (!existsSync(abs)) throw new Error("文件夹不存在");
    if (keepEntries) {
        const parentAbs = path.dirname(abs);
        const items = await fs.readdir(abs, { withFileTypes: true });
        for (const item of items) {
            const src = path.join(abs, item.name);
            const dest = path.join(parentAbs, item.name);
            if (existsSync(dest)) throw new Error(`目标位置已存在同名项, 无法上移: ${item.name}`);
            await fs.rename(src, dest);
        }
    }
    await fs.rm(abs, { recursive: true, force: true });
}

/* -------------------------------------------------------------------------- */
/* 目录扫描与树构建                                                            */
/* -------------------------------------------------------------------------- */

async function walkFiles(rootAbs: string): Promise<string[]> {
    const result: string[] = [];
    if (!existsSync(rootAbs)) return result;
    const walk = async (dir: string) => {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            const abs = path.join(dir, item.name);
            if (item.isDirectory()) {
                await walk(abs);
            } else if (item.isFile()) {
                result.push(abs);
            }
        }
    };
    await walk(rootAbs);
    return result;
}

/** 收集某个集合根目录下的全部文件夹 (集合相对路径), 用于补齐空文件夹 */
async function walkFolders(rootAbs: string): Promise<string[]> {
    const result: string[] = [];
    if (!existsSync(rootAbs)) return result;
    const walk = async (dir: string) => {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            if (!item.isDirectory()) continue;
            const abs = path.join(dir, item.name);
            result.push(toPosix(path.relative(rootAbs, abs)));
            await walk(abs);
        }
    };
    await walk(rootAbs);
    return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 解析 Markdown/MDX/HTML 文章顶部的 YAML frontmatter */
export function parseFrontmatter(text: string): Record<string, unknown> {
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};
    try {
        const parsed = yaml.load(match[1]);
        return isPlainObject(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

/** 去掉文章顶部的 frontmatter, 只保留正文 */
export function stripFrontmatterText(text: string): string {
    const match = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    return match ? text.slice(match[0].length) : text;
}

/**
 * 写回文章时保留编辑器不认识的 frontmatter 字段。
 *
 * 只有 managedKeys 里的字段会被新内容覆盖; 其余字段 (copyProtection、encrypted、
 * password、coverInContent 等) 一律保留原文件的值, 避免「保存一次就丢字段」。
 * 若新内容里缺少某个受管字段, 该字段会从原 frontmatter 中删除, 因此
 * 用户清空受管字段 (例如删除封面) 也能正确落盘。
 */
export function mergePostFrontmatter(
    originalText: string,
    newText: string,
    managedKeys: string[],
): string {
    // 用 JSON_SCHEMA 解析: 避免 js-yaml 把 `published: 2011-11-02` 解析成 Date 后
    // 又被重新序列化成 `2011-11-02T00:00:00.000Z`。日期保持写入时的字符串形态。
    const loadObject = (text: string): Record<string, unknown> => {
        const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!match) return {};
        try {
            const parsed = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
            return isPlainObject(parsed) ? parsed : {};
        } catch {
            return {};
        }
    };

    const merged: Record<string, unknown> = { ...loadObject(originalText) };
    const newData = loadObject(newText);
    // 只应用编辑器管理的字段: 其余字段一律保留原文件的值, 不受新内容影响
    for (const key of managedKeys) {
        const value = newData[key];
        if (value === undefined) continue;
        merged[key] = value;
    }
    const body = stripFrontmatterText(newText);
    const dumped = yaml.dump(merged, { lineWidth: -1, noRefs: true, quotingType: '"' });
    return `---\n${dumped}---\n${body}`;
}

function detectPostFormat(relPath: string): SiteEntryFormat {
    if (/\.html?$/i.test(relPath)) return "html";
    if (/\.mdx$/i.test(relPath)) return "mdx";
    return "markdown";
}

function jsonEntryName(collection: string, data: Record<string, unknown>, id: string): string {
    if (collection === "skills") {
        return typeof data.name === "string" && data.name ? data.name : id;
    }
    return typeof data.title === "string" && data.title ? data.title : id;
}

function jsonEntryUrl(collection: string, id: string): string {
    switch (collection) {
        case "albums":
            return `/albums/${id}/`;
        case "diary":
            return `/diary/`;
        case "projects":
            return `/projects/`;
        case "skills":
            return `/skills/`;
        case "timeline":
            return `/timeline/`;
        default:
            return `/`;
    }
}

/** 从真实文件系统收集 6 个集合的全部条目 */
export async function collectFsEntries(): Promise<ContentSourceEntry[]> {
    const entries: ContentSourceEntry[] = [];

    for (const def of SITE_COLLECTIONS) {
        const rootAbs = path.join(CONTENT_ROOT, def.relRoot);
        const files = await walkFiles(rootAbs);

        for (const abs of files) {
            const relPath = toPosix(path.relative(rootAbs, abs));
            const base = path.basename(relPath);
            if (base.startsWith("_") || base.startsWith(".")) continue;

            const ext = path.extname(relPath).toLowerCase();
            if (!def.extensions.includes(ext)) continue;

            const id = relPath.slice(0, relPath.length - ext.length);
            const folderPath = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
            const filePath = `src/content/${def.relRoot}/${relPath}`;

            if (def.entryKind === "markdown") {
                const text = (await readEntryFile(abs)) || "";
                const data = parseFrontmatter(text);
                const routeName = typeof data.routeName === "string" ? data.routeName.replace(/^\/+/, "") : "";
                entries.push({
                    collection: def.key,
                    id,
                    relPath,
                    folderPath,
                    name:
                        (typeof data.directoryTitle === "string" && data.directoryTitle) ||
                        (typeof data.title === "string" && data.title) ||
                        base,
                    url: routeName ? `/posts/${routeName}/` : `/posts/${id}/`,
                    format: detectPostFormat(relPath),
                    filePath,
                    meta: {
                        title: data.title ?? "",
                        directoryTitle: data.directoryTitle ?? "",
                        draft: data.draft === true,
                        pinned: data.pinned === true,
                        published: data.published ?? null,
                        description: data.description ?? "",
                        cover: data.cover ?? "",
                        category: data.category ?? null,
                        tags: Array.isArray(data.tags) ? data.tags : [],
                    },
                });
                continue;
            }

            let data: Record<string, unknown> = {};
            const raw = await readEntryFile(abs);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (isPlainObject(parsed)) data = parsed;
                } catch {
                    data = {};
                }
            }
            entries.push({
                collection: def.key,
                id,
                relPath,
                folderPath,
                name: jsonEntryName(def.key, data, id),
                url: jsonEntryUrl(def.key, id),
                format: "json",
                filePath,
                meta: { ...data, visible: data.visible !== false },
            });
        }
    }

    return entries;
}

/** 服务端实时目录树 (读取真实文件系统, 写完文件后立刻一致, 含空文件夹) */
export async function buildSiteTreeFromFs(): Promise<SiteDirectoryNode[]> {
    const entries = await collectFsEntries();
    const folders: Partial<Record<SiteCollectionKey, string[]>> = {};
    for (const def of SITE_COLLECTIONS) {
        const rootAbs = path.join(CONTENT_ROOT, def.relRoot);
        folders[def.key] = await walkFolders(rootAbs);
    }
    return buildSiteDirectoryTree(entries, collectionLabels(), folders);
}

/** 序列化 JSON 集合条目 (保留中文, 使用 4 空格缩进, 与仓库现有文件风格一致) */
export function serializeJsonEntry(data: unknown): string {
    return `${JSON.stringify(data, null, 4)}\n`;
}
