import type { APIContext } from "astro";

import { getSortedPosts } from "@utils/post";


// sitemap 需要文章列表, 因此按需生成 (后端不可达时只输出静态页面)
export const prerender = false;

/** 预渲染的静态页面 (与 src/pages 下的固定路由保持一致) */
const STATIC_ROUTES = [
    "/",
    "/archive/",
    "/albums/",
    "/diary/",
    "/projects/",
    "/skills/",
    "/timeline/",
    "/anime/",
    "/friends/",
    "/about/",
    "/rss/",
    "/atom/",
];

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

export async function GET(context: APIContext) {
    const site = context.site ?? new URL(context.url.origin);
    const posts = await getSortedPosts();

    const urls: string[] = STATIC_ROUTES.map((route) => new URL(route, site).href);
    for (const post of posts) {
        if (post.data.draft) continue;
        urls.push(new URL(`/posts/${post.id}/`, site).href);
    }

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `    <url><loc>${escapeXml(loc)}</loc></url>`).join("\n")}
</urlset>
`;

    return new Response(body, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
        },
    });
}
