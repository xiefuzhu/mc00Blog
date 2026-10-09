/**
 * 内容 API 的公共守卫与响应工具
 *  - 统一 JSON 响应
 *  - 轻量同源校验 (避免本机其它页面顺手写盘)
 *  - 写回能力判定 (静态部署直接拒绝)
 */

import { canWriteContent } from "./contentFs";

export function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}

export function errorResponse(message: string, status = 400, extra: Record<string, unknown> = {}): Response {
    return jsonResponse({ ok: false, message, ...extra }, status);
}

/**
 * 轻量请求守卫: 要求带 Authorization 头 (控制台会话令牌), 且 Origin (若存在) 与 Host 同源。
 * 返回 null 表示通过, 否则返回错误信息。
 */
export function guardRequest(request: Request): string | null {
    const authorization = request.headers.get("authorization");
    if (!authorization) return "缺少 Authorization 请求头";

    const origin = request.headers.get("origin");
    if (origin && origin !== "null") {
        try {
            const parsed = new URL(origin);
            const host = request.headers.get("host");
            if (host && parsed.host !== host) return "跨站请求被拒绝";
        } catch {
            return "Origin 请求头非法";
        }
    }
    return null;
}

/** 写操作守卫: 返回 Response 表示被拒绝, null 表示可以继续 */
export function requireWritable(): Response | null {
    const { writable, reason } = canWriteContent();
    if (!writable) return errorResponse(reason, 403, { writable: false });
    return null;
}
