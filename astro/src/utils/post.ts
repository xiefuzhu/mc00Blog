/**
 * 文章数据层 (服务端)
 *
 * 数据全部来自 PHP 后端 (见 src/lib/content.ts), 后端不可达时返回空数组。
 * 这里只做「与展示层约定一致」的加工: 上下篇串联、标签/分类聚合。
 */

import { i18n } from "@i18n/translation";
import I18nKey from "@i18n/i18nKey";
import { CATEGORY_SEPARATOR, type CategoryPath, getCategoryPathParts } from "@utils/category";
import { parseTags, type Tag } from "@utils/tag";
import { getCategoryUrl } from "@utils/url";
import { fetchPosts, type PostEntry } from "@/lib/content";

export type { PostEntry, PostData, PostReadingMeta, RenderedPost, TocHeading } from "@/lib/content";

/** 串联上下篇 (next = 更新的一篇, prev = 更早的一篇), 与后端排序保持一致 */
function linkNeighbors(posts: PostEntry[]): PostEntry[] {
    for (let i = 1; i < posts.length; i++) {
        posts[i].data.nextSlug = posts[i - 1].id;
        posts[i].data.nextTitle = posts[i - 1].data.title;
    }
    for (let i = 0; i < posts.length - 1; i++) {
        posts[i].data.prevSlug = posts[i + 1].id;
        posts[i].data.prevTitle = posts[i + 1].data.title;
    }
    return posts;
}

/** 已发布文章 (置顶优先, 其次按发布日期倒序), 后端已排好序 */
export async function getSortedPosts(): Promise<PostEntry[]> {
    return linkNeighbors(await fetchPosts(false));
}

/** 已发布文章 (含正文), 供 RSS / Atom 等需要全文的场景使用 */
export async function getSortedPostsWithContent(): Promise<PostEntry[]> {
    return linkNeighbors(await fetchPosts(true));
}

export type PostForList = {
    id: string;
    data: PostEntry["data"];
};

export async function getSortedPostsList(): Promise<PostForList[]> {
    const sortedFullPosts = await fetchPosts(false);
    return sortedFullPosts.map((post) => ({
        id: post.id,
        data: post.data,
    }));
}

/** 取条目正文的 HTML 字符串 (Markdown 渲染器由调用方提供) */
export function getEntryHtml(entry: PostEntry, renderMarkdown: (content: string) => string): string {
    return renderMarkdown(entry.body || "");
}

/** 取条目正文的纯文本, 用于摘要 / 搜索索引等场景 */
export function getEntryText(entry: PostEntry): string {
    return String(entry.body ?? "");
}

export async function getTagList(): Promise<Tag[]> {
    const allBlogPosts = await fetchPosts(false);

    const countMap: { [key: string]: number } = {};
    allBlogPosts.forEach((post) => {
        const tags = parseTags(post.data.tags as never);
        tags.forEach((tag: string) => {
            if (!countMap[tag]) countMap[tag] = 0;
            countMap[tag]++;
        });
    });

    const keys: string[] = Object.keys(countMap).sort((a, b) => {
        return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
    name: string;
    count: number;
    url: string;
};

export type CategoryTreeItem = {
    name: string;
    count: number;
    url: string;
    path: CategoryPath;
    children: CategoryTreeItem[];
};

export async function getCategoryList(): Promise<Category[]> {
    const allBlogPosts = await fetchPosts(false);
    const count: { [key: string]: number } = {};
    allBlogPosts.forEach((post) => {
        const categoryParts = getCategoryPathParts(post.data.category as never);
        if (!categoryParts) {
            const ucKey = i18n(I18nKey.uncategorized);
            count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
            return;
        }

        const categoryName = categoryParts.join(CATEGORY_SEPARATOR);
        count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
    });

    const lst = Object.keys(count).sort((a, b) => {
        return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    const ret: Category[] = [];
    for (const c of lst) {
        ret.push({
            name: c,
            count: count[c],
            url: getCategoryUrl(c),
        });
    }
    return ret;
}

export async function getCategoryTree(): Promise<CategoryTreeItem[]> {
    const allBlogPosts = await fetchPosts(false);

    type CategoryTreeInternal = {
        name: string;
        count: number;
        path: CategoryPath;
        children: Map<string, CategoryTreeInternal>;
    };

    const root = new Map<string, CategoryTreeInternal>();
    const uncategorizedKey = i18n(I18nKey.uncategorized);

    for (const post of allBlogPosts) {
        const rawParts = getCategoryPathParts(post.data.category as never);
        const categoryParts = rawParts && rawParts.length > 0 ? rawParts : [uncategorizedKey];
        let currentLevel = root;
        let currentPath: string[] = [];

        for (const rawName of categoryParts) {
            const name = rawName.trim();
            if (!name) continue;
            currentPath = [...currentPath, name];
            let node = currentLevel.get(name);
            if (!node) {
                node = {
                    name,
                    count: 0,
                    path: currentPath,
                    children: new Map<string, CategoryTreeInternal>(),
                };
                currentLevel.set(name, node);
            }
            node.count += 1;
            currentLevel = node.children;
        }
    }

    const buildTree = (level: Map<string, CategoryTreeInternal>): CategoryTreeItem[] => {
        const sorted = Array.from(level.values()).sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
        );
        return sorted.map((node) => ({
            name: node.name,
            count: node.count,
            path: node.path,
            url: getCategoryUrl(node.path),
            children: buildTree(node.children),
        }));
    };

    return buildTree(root);
}
