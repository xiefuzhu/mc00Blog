/**
 * /api/content/entry
 *  - GET    ?collection=&path=            读取条目原文与解析数据
 *  - PUT    创建/覆盖条目 (文章写正文, JSON 集合写校验后的数据)
 *  - POST   { op: "move", collection, from, to } 移动或重命名条目
 *  - DELETE ?collection=&path=            删除条目
 */
export const prerender = false;

import type { APIRoute } from "astro";

import { validateEntryData } from "@utils/contentSchemas";
import {
    deleteEntryFile,
    mergePostFrontmatter,
    moveEntryFile,
    readEntryFile,
    resolveEntryPath,
    serializeJsonEntry,
    writeEntryFile,
} from "@server/contentFs";
import { errorResponse, guardRequest, jsonResponse, requireWritable } from "@server/apiGuard";

function parseJsonBody(body: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(body);
        return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

export const GET: APIRoute = async ({ url }) => {
    const collection = url.searchParams.get("collection") || "";
    const relPath = url.searchParams.get("path") || "";

    const resolved = resolveEntryPath(collection, relPath);
    if (!resolved.ok) return errorResponse(resolved.error, 400);

    const content = await readEntryFile(resolved.abs);
    if (content === null) return errorResponse("条目不存在", 404);

    let data: Record<string, unknown> | null = null;
    if (resolved.collection.entryKind === "json") {
        try {
            data = JSON.parse(content);
        } catch {
            data = null;
        }
    }

    return jsonResponse({
        ok: true,
        collection,
        path: resolved.relPath,
        filePath: `src/content/${resolved.collection.relRoot}/${resolved.relPath}`,
        content,
        data,
    });
};

export const PUT: APIRoute = async ({ request }) => {
    const blocked = requireWritable();
    if (blocked) return blocked;
    const guardError = guardRequest(request);
    if (guardError) return errorResponse(guardError, 401);

    const body = parseJsonBody(await request.text());
    if (!body) return errorResponse("请求体不是合法 JSON");

    const collection = String(body.collection || "");
    const relPath = String(body.path || "");
    const overwrite = body.overwrite !== false;

    const resolved = resolveEntryPath(collection, relPath);
    if (!resolved.ok) return errorResponse(resolved.error, 400);

    const existing = await readEntryFile(resolved.abs);
    const created = existing === null;
    if (!created && !overwrite) {
        return errorResponse("目标条目已存在", 409, { created: false });
    }

    let payload: string;
    if (resolved.collection.entryKind === "json") {
        if (typeof body.data !== "object" || body.data === null) {
            return errorResponse("JSON 集合必须提供 data 对象");
        }
        const result = validateEntryData(collection, body.data);
        if (!result.ok) return errorResponse("数据校验未通过", 422, { errors: result.errors });
        payload = serializeJsonEntry(result.data);
    } else {
        if (typeof body.content !== "string") {
            return errorResponse("文章条目必须提供 content 字符串");
        }
        // 提供 frontmatterKeys 时, 保留原文件中编辑器不认识的 frontmatter 字段
        // (copyProtection / encrypted / password / coverInContent 等), 避免保存丢字段。
        const managedKeys = Array.isArray(body.frontmatterKeys)
            ? body.frontmatterKeys.filter((key): key is string => typeof key === "string")
            : null;
        if (managedKeys && managedKeys.length > 0 && existing !== null) {
            payload = mergePostFrontmatter(existing, body.content, managedKeys);
        } else {
            payload = body.content;
        }
    }

    await writeEntryFile(resolved.abs, payload);

    return jsonResponse({
        ok: true,
        created,
        collection,
        path: resolved.relPath,
        filePath: `src/content/${resolved.collection.relRoot}/${resolved.relPath}`,
    });
};

export const POST: APIRoute = async ({ request }) => {
    const blocked = requireWritable();
    if (blocked) return blocked;
    const guardError = guardRequest(request);
    if (guardError) return errorResponse(guardError, 401);

    const body = parseJsonBody(await request.text());
    if (!body) return errorResponse("请求体不是合法 JSON");
    if (body.op !== "move") return errorResponse("不支持的操作");

    const collection = String(body.collection || "");
    const from = resolveEntryPath(collection, String(body.from || ""));
    if (!from.ok) return errorResponse(`源路径非法: ${from.error}`, 400);
    const to = resolveEntryPath(collection, String(body.to || ""));
    if (!to.ok) return errorResponse(`目标路径非法: ${to.error}`, 400);

    const existing = await readEntryFile(from.abs);
    if (existing === null) return errorResponse("源条目不存在", 404);

    try {
        await moveEntryFile(from.abs, to.abs, body.overwrite === true);
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "移动失败", 409);
    }

    return jsonResponse({
        ok: true,
        collection,
        from: from.relPath,
        to: to.relPath,
        filePath: `src/content/${to.collection.relRoot}/${to.relPath}`,
    });
};

export const DELETE: APIRoute = async ({ request, url }) => {
    const blocked = requireWritable();
    if (blocked) return blocked;
    const guardError = guardRequest(request);
    if (guardError) return errorResponse(guardError, 401);

    const collection = url.searchParams.get("collection") || "";
    const relPath = url.searchParams.get("path") || "";

    const resolved = resolveEntryPath(collection, relPath);
    if (!resolved.ok) return errorResponse(resolved.error, 400);

    const removed = await deleteEntryFile(resolved.abs);
    if (!removed) return errorResponse("条目不存在", 404);

    return jsonResponse({ ok: true, collection, path: resolved.relPath });
};
