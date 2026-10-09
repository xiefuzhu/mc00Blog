/**
 * 站点内容树 (运行时)
 *
 * 直接使用后端 GET /api/public/directory 返回的目录树 —— 该树由 PHP 扫描
 * php/articles/ 的真实目录生成, 因此博客「目录」面板的文件夹嵌套结构与后端
 * 文章文件夹结构完全一致, 不再依赖构建期的内容集合。
 *
 * 后端不可达时返回空数组 (前端显示空内容)。
 */

import { fetchDirectoryTree } from "@/lib/content";
import { i18n } from "../i18n/translation";
import I18nKey from "../i18n/i18nKey";
import {
    SITE_COLLECTIONS,
    type SiteCollectionKey,
    type SiteCollectionLabels,
    type SiteDirectoryNode,
} from "./contentCollections";

/** 集合显示名 (与首页「目录」面板文字完全一致) */
export function collectionLabels(): SiteCollectionLabels {
    const labels: SiteCollectionLabels = {};
    for (const def of SITE_COLLECTIONS) {
        labels[def.key] = i18n(def.i18nKey as I18nKey);
    }
    return labels;
}

/** 六个根集合的完整目录树 (来自后端真实文件系统) */
export async function buildSiteTree(): Promise<SiteDirectoryNode[]> {
    const tree = await fetchDirectoryTree<SiteDirectoryNode>();
    if (tree.length === 0) return [];

    const labels = collectionLabels();
    return tree.map((root) => {
        const label = labels[root.collection as SiteCollectionKey];
        if (!label) return root;
        return { ...root, name: label, label };
    });
}
