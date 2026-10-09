import { buildSiteTree } from "./contentTree";
import type { SiteDirectoryNode } from "./contentCollections";


export interface DirectoryNode {
    name: string;
    type: 'folder' | 'file';
    url?: string;
    children?: DirectoryNode[];
}

/**
 * 首页「目录」面板可见性规则:
 *  - 文章: draft 条目不在首页面板中展示
 *  - 相册: visible === false 的条目不在首页面板中展示
 * 其余集合全部展示。
 */
function isVisibleOnHomepage(node: SiteDirectoryNode): boolean {
    if (node.type !== "entry") return true;
    const meta = node.meta || {};
    if (node.collection === "posts" && meta.draft === true) return false;
    if (node.collection === "albums" && meta.visible === false) return false;
    return true;
}

/**
 * 与旧实现保持一致的层级归并: 同级同名节点后者覆盖前者 (Map 保留首次出现的位置),
 * 随后按「文件夹优先 + 名称字母序」排序。
 */
function mergeAndSort(nodes: DirectoryNode[]): DirectoryNode[] {
    const map = new Map<string, DirectoryNode>();
    for (const node of nodes) map.set(node.name, node);
    const list = [...map.values()];
    list.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
    return list;
}

/** 转换为首页节点; 不含任何可见内容的文件夹返回 null (与旧实现一致, 不会凭空出现空目录) */
function toDirectoryNode(node: SiteDirectoryNode): DirectoryNode | null {
    if (node.type === "entry") {
        if (!isVisibleOnHomepage(node)) return null;
        return { name: node.name, type: 'file', url: node.url };
    }

    const children = mergeAndSort(
        (node.children || [])
            .map(toDirectoryNode)
            .filter((child): child is DirectoryNode => child !== null),
    );
    if (children.length === 0) return null;
    return { name: node.name, type: 'folder', children };
}

/**
 * 首页「目录」面板的目录树。
 * 结构与内容完全由 contentCollections/contentTree 的集合注册表派生, 因此与
 * 控制台的文件夹树同源; 不含可见内容的集合不展示, 以保持首页历史表现不变。
 */
export async function getDirectoryTree(): Promise<DirectoryNode[]> {
    const tree = await buildSiteTree();
    return mergeAndSort(
        tree
            .map(toDirectoryNode)
            .filter((node): node is DirectoryNode => node !== null),
    );
}
