import type { APIContext } from "astro";
import sanitizeHtml from "sanitize-html";

import { siteConfig, profileConfig } from "@/config";
import { getSortedPostsWithContent } from "@utils/post";
import { renderPostEntry } from "@/lib/content";
import { getCategoryPathParts } from "@utils/category";
import { parseTags } from "@utils/tag";
import { getPostUrl } from "@utils/url";


// 文章在请求时从 PHP 后端获取
export const prerender = false;

function escapeXml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function wrapCdata(value: string) {
    return value.replace(/]]>/g, "]]]]><![CDATA[>");
}

export async function GET(context: APIContext) {
    if (!context.site) {
        throw Error("site not set");
    }

    // 过滤掉加密文章和草稿文章
    const posts = (await getSortedPostsWithContent()).filter(
        (post) => !post.data.encrypted && post.data.draft !== true,
    );

    // 创建Atom feed头部
    let atomFeed = `<?xml version="1.0" encoding="utf-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
        <title>${escapeXml(siteConfig.title)}</title>
        <subtitle>${escapeXml(siteConfig.subtitle || "No description")}</subtitle>
        <link href="${escapeXml(context.site.href)}" rel="alternate" type="text/html"/>
        <link href="${escapeXml(new URL("atom.xml", context.site).href)}" rel="self" type="application/atom+xml"/>
        <id>${escapeXml(context.site.href)}</id>
        <updated>${new Date().toISOString()}</updated>
        <language>${escapeXml(siteConfig.lang)}</language>`;

    for (const post of posts) {
        // 服务端渲染正文; 图片等相对路径已被改写为后端资源接口的绝对地址
        const content = sanitizeHtml(renderPostEntry(post).html, {
            allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
        });

        // 添加Atom条目
        const postUrl = new URL(getPostUrl(post), context.site).href;

        atomFeed += `
        <entry>
            <title>${escapeXml(post.data.title)}</title>
            <link href="${escapeXml(postUrl)}" rel="alternate" type="text/html"/>
            <id>${escapeXml(postUrl)}</id>
            <published>${post.data.published.toISOString()}</published>
            <updated>${(post.data.updated || post.data.published).toISOString()}</updated>
            <summary>${escapeXml(post.data.description || "")}</summary>
            <content type="html"><![CDATA[${wrapCdata(content)}]]></content>
            <author>
                <name>${escapeXml(profileConfig.name)}</name>
            </author>`;
        // 添加分类标签
        const categoryParts = getCategoryPathParts(post.data.category);
        if (categoryParts && categoryParts.length > 0) {
            for (let i = 0; i < categoryParts.length; i++) {
                const term = categoryParts.slice(0, i + 1).join(" / ");
                atomFeed += `
            <category term="${escapeXml(term)}"></category>`;
            }
        }
        // 添加标签
        const postTags = parseTags(post.data.tags);
        if (postTags && postTags.length > 0) {
            for (const tag of postTags) {
                atomFeed += `
            <category term="${escapeXml(tag)}" label="${escapeXml(tag)}"></category>`;
            }
        }
        atomFeed += `
            </entry>`;
    }

    // 关闭Atom feed
    atomFeed += `
        </feed>`;

    return new Response(atomFeed, {
        headers: {
            "Content-Type": "application/atom+xml; charset=utf-8",
        },
    });
}
