/**
 * /api/content/folder
 *  - POST   { collection, parent, name }        新建文件夹
 *  - PUT    { collection, from, to }            重命名或移动文件夹
 *  - DELETE ?collection=&path=&keepEntries=     删除文件夹 (keepEntries 时把内容上移一级)
 */
export const prerender = false;

import type { APIRoute } from "astro";
import path from "node:path";

import { createFolder, deleteFolder, renameFolder, resolveFolderPath } from "@server/contentFs";
import { errorResponse, guardRequest, jsonResponse, requireWritable } from "@server/apiGuard";

const INVALID_NAME = /[\\/:*?"<>|]/;

function parseJsonBody(body: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(body);
        return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

/** 校验单个文件夹名称 (不允许路径分隔符与保留字符) */
function validateFolderName(name: string): string | null {
    const trimmed = (name || "").trim();
    if (!trimmed) return "文件夹名称不能为空";
    if (trimmed === "." || trimmed === "..") return "文件夹名称非法";
    if (trimmed.startsWith(".")) return "文件夹名称不能以点号开头";
    if (INVALID_NAME.test(trimmed)) return "文件夹名称包含非法字符";
    return null;
}

function joinFolder(parent: string, name: string): string {
    const base = (parent || "").replace(/^\/+|\/+$/g, "");
    return base ? `${base}/${name}` : name;
}

export const POST: APIRoute = async ({ request }) => {
    const blocked = requireWritable();
    if (blocked) return blocked;
    const guardError = guardRequest(request);
    if (guardError) return errorResponse(guardError, 401);

    const body = parseJsonBody(await request.text());
    if (!body) return errorResponse("请求体不是合法 JSON");

    const collection = String(body.collection || "");
    const nameError = validateFolderName(String(body.name || ""));
    if (nameError) return errorResponse(nameError, 400);

    const target = joinFolder(String(body.parent || ""), String(body.name).trim());
    const resolved = resolveFolderPath(collection, target);
    if (!resolved.ok) return errorResponse(resolved.error, 400);

    try {
        await createFolder(resolved.abs);
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "创建文件夹失败", 409);
    }

    return jsonResponse({ ok: true, collection, path: resolved.relPath });
};

export const PUT: APIRoute = async ({ request }) => {
    const blocked = requireWritable();
    if (blocked) return blocked;
    const guardError = guardRequest(request);
    if (guardError) return errorResponse(guardError, 401);

    const body = parseJsonBody(await request.text());
    if (!body) return errorResponse("请求体不是合法 JSON");

    const collection = String(body.collection || "");
    const from = resolveFolderPath(collection, String(body.from || ""));
    if (!from.ok) return errorResponse(`源文件夹非法: ${from.error}`, 400);
    const to = resolveFolderPath(collection, String(body.to || ""));
    if (!to.ok) return errorResponse(`目标文件夹非法: ${to.error}`, 400);

    // 禁止把文件夹移动到自身或自己的子孙目录下
    if (to.abs === from.abs || to.abs.startsWith(from.abs + path.sep)) {
        return errorResponse("不能移动到自身或子文件夹中", 400);
    }

    try {
        await renameFolder(from.abs, to.abs);
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "移动文件夹失败", 409);
    }

    return jsonResponse({ ok: true, collection, from: from.relPath, to: to.relPath });
};

export const DELETE: APIRoute = async ({ request, url }) => {
    const blocked = requireWritable();
    if (blocked) return blocked;
    const guardError = guardRequest(request);
    if (guardError) return errorResponse(guardError, 401);

    const collection = url.searchParams.get("collection") || "";
    const keepEntries = url.searchParams.get("keepEntries") === "true";

    const resolved = resolveFolderPath(collection, url.searchParams.get("path") || "");
    if (!resolved.ok) return errorResponse(resolved.error, 400);

    try {
        await deleteFolder(resolved.abs, keepEntries);
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "删除文件夹失败", 409);
    }

    return jsonResponse({ ok: true, collection, path: resolved.relPath, keepEntries });
};
