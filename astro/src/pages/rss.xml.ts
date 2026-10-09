import type { APIContext } from "astro";
import type { RSSFeedItem } from "@astrojs/rss";
import rss from "@astrojs/rss";
import sanitizeHtml from "sanitize-html";

import { siteConfig } from "@/config";
import { getSortedPostsWithContent } from "@utils/post";
import { renderPostEntry } from "@/lib/content";
import { getCategoryPathLabel } from "@utils/category";
import { parseTags } from "@utils/tag";
import { getPostUrl } from "@utils/url";


// 文章在请求时从 PHP 后端获取
export const prerender = false;

export async function GET(context: APIContext) {
    if (!context.site) {
        throw Error("site not set");
    }

    // Use the same ordering as site listing (pinned first, then by published desc)
    const posts = (await getSortedPostsWithContent()).filter((post) => !post.data.encrypted);
    const feed: RSSFeedItem[] = [];

    for (const post of posts) {
        // 服务端渲染正文; 图片等相对路径已被改写为后端资源接口的绝对地址
        const content = sanitizeHtml(renderPostEntry(post).html, {
            allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
        });

        const categories: string[] = [];
        const categoryLabel = getCategoryPathLabel(post.data.category);
        if (categoryLabel) categories.push(categoryLabel);

        const tags = parseTags(post.data.tags);
        if (tags && tags.length > 0) categories.push(...tags);

        feed.push({
            title: post.data.title,
            description: post.data.description,
            pubDate: post.data.published,
            link: getPostUrl(post),
            categories,
            content,
        });
    }

    return rss({
        title: siteConfig.title,
        description: siteConfig.subtitle || "No description",
        site: context.site,
        items: feed,
        customData: `<language>${siteConfig.lang}</language>`,
    });
}
