/**
 * 构建期站点内容树
 *
 * 把博客现有的 6 个内容集合(posts / albums / diary / projects / skills / timeline)
 * 归一化成 ContentSourceEntry, 再交给 contentCollections.buildSiteDirectoryTree 组装。
 *
 * 本文件依赖 Astro 内容层(astro:content) 与各集合的构建期 glob 数据, 因此只能在
 * 构建期或 Astro 服务端使用, 不能进入浏览器端 bundle。
 */

import { getSortedPosts } from "./post";
import { sortedAlbums } from "./albums";
import { sortedMoments } from "./diary";
import { projectsData } from "./projects";
import { skillsData } from "./skills";
import { timelineData } from "./timeline";
import { getPostUrl } from "./url";
import { i18n } from "../i18n/translation";
import I18nKey from "../i18n/i18nKey";
import {
    SITE_COLLECTIONS,
    buildSiteDirectoryTree,
    type ContentSourceEntry,
    type SiteCollectionKey,
    type SiteCollectionLabels,
    type SiteDirectoryNode,
    type SiteEntryFormat,
} from "./contentCollections";

function normalizePath(value: string): string {
    return (value || "").replace(/\\/g, "/");
}

/** 从源文件路径中取出相对集合根目录的路径 (含扩展名) */
function relPathFromFilePath(filePath: string | undefined, id: string): string {
    if (filePath) {
        const match = normalizePath(filePath).match(/content\/posts\/(.+)$/);
        if (match) return match[1];
    }
    return `${id}.md`;
}

/** 从构建期 glob 的 basePath (形如 content/albums/example) 推导集合内相对路径 */
function relPathFromBasePath(basePath: string | undefined, collection: SiteCollectionKey, id: string): string {
    const normalized = normalizePath(basePath || "").replace(/^\.\.\//, "");
    const match = normalized.match(new RegExp(`content/${collection}/(.*)$`));
    const sub = match ? match[1].replace(/\/+$/, "") : "";
    return sub ? `${sub}/${id}.json` : `${id}.json`;
}

function folderOf(relPath: string): string {
    const parts = relPath.split("/");
    parts.pop();
    return parts.join("/");
}

function detectPostFormat(relPath: string): SiteEntryFormat {
    if (/\.html?$/i.test(relPath)) return "html";
    if (/\.mdx$/i.test(relPath)) return "mdx";
    return "markdown";
}

/** 集合显示名 (与首页「目录」面板文字完全一致) */
export function collectionLabels(): SiteCollectionLabels {
    const labels: SiteCollectionLabels = {};
    for (const def of SITE_COLLECTIONS) {
        labels[def.key] = i18n(def.i18nKey as I18nKey);
    }
    return labels;
}

/** 收集全部 6 个集合的真实条目 (含草稿与不可见条目, 由消费方自行决定是否过滤) */
export async function collectSiteEntries(): Promise<ContentSourceEntry[]> {
    const entries: ContentSourceEntry[] = [];

    const posts = await getSortedPosts();
    for (const post of posts) {
        const relPath = relPathFromFilePath(post.filePath, post.id);
        entries.push({
            collection: "posts",
            id: post.id,
            relPath,
            folderPath: folderOf(relPath),
            name: post.data.directoryTitle || post.data.title || relPath.split("/").pop()!,
            url: getPostUrl(post),
            format: detectPostFormat(relPath),
            filePath: `src/content/posts/${relPath}`,
            meta: {
                title: post.data.title,
                directoryTitle: post.data.directoryTitle || "",
                draft: post.data.draft === true,
                pinned: post.data.pinned === true,
                published: post.data.published ? new Date(post.data.published).toISOString() : null,
                description: post.data.description || "",
                cover: post.data.cover || "",
                category: (post.data.category as string | string[] | null) ?? null,
                tags: Array.isArray(post.data.tags) ? post.data.tags : [],
            },
        });
    }

    for (const album of sortedAlbums) {
        const relPath = relPathFromBasePath(album.basePath, "albums", album.id);
        const { basePath, ...data } = album as unknown as Record<string, unknown> & { basePath?: string };
        entries.push({
            collection: "albums",
            id: album.id,
            relPath,
            folderPath: folderOf(relPath),
            name: album.title || album.id,
            url: `/albums/${album.id}/`,
            format: "json",
            filePath: `src/content/albums/${relPath}`,
            meta: { ...data, visible: album.visible !== false },
        });
    }

    for (const moment of sortedMoments) {
        const relPath = relPathFromBasePath(moment.basePath, "diary", moment.id);
        const { basePath, ...data } = moment as unknown as Record<string, unknown> & { basePath?: string };
        entries.push({
            collection: "diary",
            id: moment.id,
            relPath,
            folderPath: folderOf(relPath),
            name: moment.title || moment.id,
            url: `/diary/`,
            format: "json",
            filePath: `src/content/diary/${relPath}`,
            meta: { ...data },
        });
    }

    for (const project of projectsData) {
        const relPath = relPathFromBasePath(project.basePath, "projects", project.id);
        const { basePath, ...data } = project as unknown as Record<string, unknown> & { basePath?: string };
        entries.push({
            collection: "projects",
            id: project.id,
            relPath,
            folderPath: folderOf(relPath),
            name: project.title || project.id,
            url: `/projects/`,
            format: "json",
            filePath: `src/content/projects/${relPath}`,
            meta: { ...data },
        });
    }

    for (const skill of skillsData) {
        const relPath = relPathFromBasePath(skill.basePath, "skills", skill.id);
        const { basePath, ...data } = skill as unknown as Record<string, unknown> & { basePath?: string };
        entries.push({
            collection: "skills",
            id: skill.id,
            relPath,
            folderPath: folderOf(relPath),
            name: skill.name || skill.id,
            url: `/skills/`,
            format: "json",
            filePath: `src/content/skills/${relPath}`,
            meta: { ...data },
        });
    }

    for (const item of timelineData) {
        const relPath = relPathFromBasePath(item.basePath, "timeline", item.id);
        const { basePath, ...data } = item as unknown as Record<string, unknown> & { basePath?: string };
        entries.push({
            collection: "timeline",
            id: item.id,
            relPath,
            folderPath: folderOf(relPath),
            name: item.title || item.id,
            url: `/timeline/`,
            format: "json",
            filePath: `src/content/timeline/${relPath}`,
            meta: { ...data },
        });
    }

    return entries;
}

/** 构建 6 个根集合的完整目录树 (构建期版本) */
export async function buildSiteTree(): Promise<SiteDirectoryNode[]> {
    const entries = await collectSiteEntries();
    return buildSiteDirectoryTree(entries, collectionLabels());
}
