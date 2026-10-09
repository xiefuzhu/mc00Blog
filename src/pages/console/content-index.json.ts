/**
 * 站点真实内容索引 (构建时生成)
 *
 * 控制台据此:
 *  1. 还原与首页「目录」面板完全同源的 6 个集合目录树 (posts/albums/diary/projects/skills/timeline)
 *  2. 解析每个条目在前台的真实路由
 *  3. 在只读环境 (静态部署) 下也能浏览与导出全部集合的内容
 */
export const prerender = true;

import type { APIRoute } from "astro";

import { getSortedPosts } from "@utils/post";
import { getPostUrl, removeFileExtension } from "@utils/url";
import {
    SITE_COLLECTIONS,
    collectFolderPaths,
    type SiteEntryFormat,
} from "@utils/contentCollections";
import { buildSiteTree, collectSiteEntries, collectionLabels } from "@utils/contentTree";

interface ContentIndexEntry {
    id: string;
    slug: string;
    url: string;
    title: string;
    directoryTitle: string;
    folderPath: string;
    category: string | string[] | null;
    tags: string[];
    format: "markdown" | "mdx" | "html";
    draft: boolean;
    pinned: boolean;
    published: string | null;
    description: string;
    cover: string;
}

interface SiteIndexEntry {
    collection: string;
    id: string;
    name: string;
    folderPath: string;
    relPath: string;
    filePath: string;
    url: string;
    format: SiteEntryFormat;
    meta: Record<string, unknown>;
}

/**
 * 识别正文格式。
 * 注意: 内容集合的 id 已经被 loader 去掉了扩展名 (mermaids / guide/getting-started),
 * 因此必须用源文件路径 (post.filePath, 形如 src/content/posts/x.html) 来判断格式。
 */
function detectFormat(id: string, filePath?: string): ContentIndexEntry["format"] {
    const source = filePath || id;
    if (/\.html?$/i.test(source)) return "html";
    if (/\.mdx$/i.test(source)) return "mdx";
    return "markdown";
}

export const GET: APIRoute = async () => {
    const [posts, tree, allEntries] = await Promise.all([
        getSortedPosts(),
        buildSiteTree(),
        collectSiteEntries(),
    ]);

    const postEntries: ContentIndexEntry[] = posts.map((post) => {
        const parts = post.id.split("/");
        parts.pop();
        const folderPath = parts.join("/");

        return {
            id: post.id,
            slug: removeFileExtension(post.id),
            url: getPostUrl(post),
            title: post.data.title,
            directoryTitle: post.data.directoryTitle || "",
            folderPath,
            category: (post.data.category as string | string[] | null) ?? null,
            tags: Array.isArray(post.data.tags) ? post.data.tags : [],
            format: detectFormat(post.id, post.filePath),
            draft: post.data.draft === true,
            pinned: post.data.pinned === true,
            published: post.data.published ? new Date(post.data.published).toISOString() : null,
            description: post.data.description || "",
            cover: post.data.cover || "",
        };
    });

    const entries: SiteIndexEntry[] = allEntries.map((entry) => ({
        collection: entry.collection,
        id: entry.id,
        name: entry.name,
        folderPath: entry.folderPath,
        relPath: entry.relPath,
        filePath: entry.filePath,
        url: entry.url,
        format: entry.format,
        meta: entry.meta,
    }));

    const labels = collectionLabels();

    const collections = SITE_COLLECTIONS.map((def) => ({
        key: def.key,
        label: labels[def.key] || def.fallbackLabel,
        root: def.root,
        relRoot: def.relRoot,
        listUrl: def.listUrl,
        entryKind: def.entryKind,
        extensions: def.extensions,
        entryCount: entries.filter((entry) => entry.collection === def.key).length,
        folderPaths: collectFolderPaths(tree, def.key).sort(),
    }));

    // 文章文件夹路径 (供控制台文章文件夹与旧逻辑使用)
    const postFolderPaths = new Set<string>();
    for (const entry of postEntries) {
        if (!entry.folderPath) continue;
        let accumulated = "";
        for (const segment of entry.folderPath.split("/").filter(Boolean)) {
            accumulated = accumulated ? `${accumulated}/${segment}` : segment;
            postFolderPaths.add(accumulated);
        }
    }

    return new Response(
        JSON.stringify({
            generatedAt: new Date().toISOString(),
            collections,
            tree,
            entries,
            posts: postEntries,
            folderPaths: [...postFolderPaths].sort(),
            postEntryCount: postEntries.length,
            siteEntryCount: entries.length,
        }),
        {
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-cache",
            },
        },
    );
};
