/**
 * GET /api/content/capabilities
 * 返回当前环境是否可真实写回内容文件, 以及 6 个集合的元信息。
 */
export const prerender = false;

import type { APIRoute } from "astro";

import { SITE_COLLECTIONS } from "@utils/contentCollections";
import { canWriteContent, CONTENT_ROOT, collectionLabels, REPO_ROOT } from "@server/contentFs";
import { jsonResponse } from "@server/apiGuard";

export const GET: APIRoute = async () => {
    const { writable, reason } = canWriteContent();
    const labels = collectionLabels();

    return jsonResponse({
        ok: true,
        writable,
        reason,
        repoRoot: REPO_ROOT,
        contentRoot: CONTENT_ROOT,
        collections: SITE_COLLECTIONS.map((def) => ({
            key: def.key,
            label: labels[def.key] || def.fallbackLabel,
            root: def.root,
            relRoot: def.relRoot,
            extensions: def.extensions,
            entryKind: def.entryKind,
            listUrl: def.listUrl,
        })),
    });
};
