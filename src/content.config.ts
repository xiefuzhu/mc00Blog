import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import type { Loader, LoaderContext } from "astro/loaders";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from 'astro/zod';

import { getCategoryPathParts } from "@utils/category";
import { parseTags } from "@utils/tag";
import { htmlPosts } from "./loaders/html-posts";


// Helper for handling dates that might be empty strings from JSON
const optionalDateSchema = z.preprocess((arg) => {
    if (typeof arg === "string" && arg.trim() === "") return undefined;
    return arg;
}, z.coerce.date().optional());

const categorySchema = z.preprocess((arg) => {
    const parts = getCategoryPathParts(arg as any);
    return parts ?? arg;
}, z.union([z.string(), z.array(z.string())]).optional().nullable().default(""));

const tagsSchema = z.preprocess((arg) => {
    return parseTags(arg);
}, z.array(z.string()).optional().default([]));

/** 文章目录的基础路径（md / mdx 与 html 共用同一个内容集合） */
const POSTS_BASE = "./src/content/posts";

/**
 * 组合 loader：让同一个 posts 集合同时接受 Markdown / MDX 与 HTML 文章。
 *
 * 为什么需要这一层
 * ---------------------------------------------------------------------------
 * glob()（astro/dist/content/loaders/glob.js）依据扩展名推导 entry type，只认
 * .md / .mdx / .json / .yaml / .yml，命中 .html 时会打印 "No entry type found" 并跳过，
 * 因此 .html 文章必须由自定义 loader 读取。而一个集合只能配置一个 loader，所以这里
 * 把「md/mdx 的 glob loader」与「html 的自定义 loader」组合成一个 loader。
 *
 * 清理职责（关键，曾经的 bug 就在这里）
 * ---------------------------------------------------------------------------
 * glob() 会在 load 开头执行 `const untouchedEntries = new Set(store.keys())`，处理每个
 * 文件时 `untouchedEntries.delete(id)`，最后把剩下的（即源文件已被删除的）条目整批删掉。
 * 两个子 loader 写同一个集合时，后运行的 loader 会把前一个 loader 的条目当成「未被
 * 触碰」而全部删除。
 *
 * 注意：glob 的 `untouchedEntries.delete(id)` 只在它真正处理该文件时执行，而「内容未变
 * → 直接 return」的分支同样算处理过。所以「记录哪些 id 被写入过」的做法是错误的：
 * 增量同步时（digest 未变）两个子 loader 都不写入任何条目，清理逻辑就会把整批文章
 * 误删，于是集合在「满」与「空」之间来回翻转。
 *
 * 现在的做法：给两个子 loader 传入 keys() 恒为空的 store 守卫，关闭它们各自的清理逻辑；
 * 然后在末尾按「条目对应的源文件是否仍然存在」统一清理一次，既保留删除语义，又不依赖
 * 任何子 loader 的内部行为。
 */
function createPostsLoader(): Loader {
    const markdown = glob({ pattern: "**/[^_]*.{md,mdx}", base: POSTS_BASE });
    const html = htmlPosts({ base: POSTS_BASE });

    return {
        name: "posts-loader",
        load: async (context: LoaderContext) => {
            type Store = LoaderContext["store"];

            // 本次加载前已存在的条目（含 filePath，用于判断源文件是否还在）
            const initialEntries = context.store.keys().map((id) => ({
                id,
                filePath: context.store.get(id)?.filePath,
            }));

            // keys() 恒为空 → 两个子 loader 都不会执行「未被触碰即删除」
            const store: Store = { ...context.store, keys: () => [] };

            await markdown.load({ ...context, store });
            await html.load({ ...context, store });

            // 统一的删除语义：源文件已被移除的条目在这里被清掉
            for (const { id, filePath } of initialEntries) {
                if (!filePath) continue;
                if (!existsSync(fileURLToPath(new URL(filePath, context.config.root)))) {
                    context.store.delete(id);
                }
            }
        },
    };
}

const postsCollection = defineCollection({
    loader: createPostsLoader(),
    schema: z.object({
        title: z.coerce.string(),
        directoryTitle: z.coerce.string().optional().default("").transform(s => s.trim()),
        published: optionalDateSchema,
        updated: optionalDateSchema,
        description: z.string().optional().default(""),
        cover: z.string().optional().default(""),
        coverInContent: z.boolean().optional().default(false),
        category: categorySchema,
        tags: tagsSchema,
        lang: z.string().optional().default(""),
        pinned: z.boolean().optional().default(false),
        author: z.string().optional().default(""),
        sourceLink: z.string().optional().default(""),
        licenseName: z.string().optional().default(""),
        licenseUrl: z.string().optional().default(""),
        comment: z.boolean().optional().default(true),
        draft: z.boolean().optional().default(false),

        /* Page encryption fields */
        encrypted: z.boolean().optional().default(false),
        password: z.string().optional().default(""),

        /* Copy protection fields */
        copyProtection: z.object({
            blockSelection: z.boolean().optional().default(false),
            blockClipboard: z.boolean().optional().default(false),
            blockContextMenu: z.boolean().optional().default(false),
            blockDevTools: z.boolean().optional().default(false),
        }).optional().default({
            blockSelection: false,
            blockClipboard: false,
            blockContextMenu: false,
            blockDevTools: false,
        }),

        /* Custom routeName */
        routeName: z.string().optional(),

        /* For internal use */
        prevTitle: z.string().default(""),
        prevSlug: z.string().default(""),
        nextTitle: z.string().default(""),
        nextSlug: z.string().default(""),
    }),
});

const specCollection = defineCollection({
    loader: glob({ pattern: '[^_]*.{md,mdx}', base: "./src/content" }),
    schema: z.object({
        title: z.coerce.string().optional(),
        description: z.string().optional(),
    }),
});

export const collections = {
    posts: postsCollection,
    spec: specCollection,
};