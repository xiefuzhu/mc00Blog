/**
 * GET /api/content/tree
 * 读取真实文件系统, 返回与首页「目录」面板同源的 6 个集合实时目录树。
 */
export const prerender = false;

import type { APIRoute } from "astro";

import { buildSiteTreeFromFs, canWriteContent } from "@server/contentFs";
import { jsonResponse } from "@server/apiGuard";

export const GET: APIRoute = async () => {
    const tree = await buildSiteTreeFromFs();
    const { writable, reason } = canWriteContent();
    return jsonResponse({
        ok: true,
        generatedAt: new Date().toISOString(),
        writable,
        reason,
        tree,
    });
};
