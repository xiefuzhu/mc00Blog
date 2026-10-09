<script lang="ts">
/**
 * 内容集合目录树
 * 渲染与博客首页「目录」面板同源的 6 个根集合 (posts/albums/diary/projects/skills/timeline),
 * 逐级展开真实子文件夹与真实条目, 行样式与数字徽章沿用首页面板语言。
 */
import Icon from "@components/common/icon.svelte";
import type { SiteCollectionKey, SiteDirectoryNode } from "@utils/contentCollections";

interface Props {
    /** 6 个根集合节点 */
    tree: SiteDirectoryNode[];
    selectedCollection: SiteCollectionKey;
    /** null 表示整个集合; 空串表示集合根目录 (未归档); "__recycle__" 表示回收站 */
    selectedFolderPath: string | null;
    includeSubfolders: boolean;
    recycleCount: number;
    isExpanded: (collection: SiteCollectionKey, folderPath: string) => boolean;
    onToggleExpand: (collection: SiteCollectionKey, folderPath: string) => void;
    onSelectCollection: (collection: SiteCollectionKey) => void;
    onSelectFolder: (collection: SiteCollectionKey, folderPath: string) => void;
    onSelectUnfiled: (collection: SiteCollectionKey) => void;
    onSelectRecycle: () => void;
    onToggleIncludeSubfolders: () => void;
    onOpenEntry: (node: SiteDirectoryNode) => void;
}

let {
    tree,
    selectedCollection,
    selectedFolderPath,
    includeSubfolders,
    recycleCount,
    isExpanded,
    onToggleExpand,
    onSelectCollection,
    onSelectFolder,
    onSelectUnfiled,
    onSelectRecycle,
    onToggleIncludeSubfolders,
    onOpenEntry,
}: Props = $props();

function handleKey(event: KeyboardEvent, action: () => void) {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        action();
    }
}

const ENTRY_ICON: Record<string, string> = {
    markdown: "material-symbols:markdown",
    mdx: "material-symbols:code-blocks",
    html: "material-symbols:html",
    json: "material-symbols:data-object",
};
</script>

{#snippet renderEntry(node: SiteDirectoryNode)}
    <div
        class="console-row"
        role="button"
        tabindex="0"
        title={node.file || node.name}
        onclick={() => onOpenEntry(node)}
        onkeydown={(event) => handleKey(event, () => onOpenEntry(node))}
    >
        <span class="w-4 h-4 shrink-0"></span>
        <Icon
            icon={ENTRY_ICON[node.format || "json"] || "material-symbols:description-outline"}
            class="text-base shrink-0 opacity-70"
        />
        <span class="truncate mr-auto text-left">{node.name}</span>
        {#if node.meta && node.meta.draft === true}
            <span class="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                草稿
            </span>
        {/if}
    </div>
{/snippet}

{#snippet renderFolder(collection: SiteCollectionKey, node: SiteDirectoryNode)}
    {@const expanded = isExpanded(collection, node.folderPath)}
    {@const hasChildren = (node.children || []).length > 0}
    <div class="min-w-0">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="console-row group/folder {selectedCollection === collection && selectedFolderPath === node.folderPath ? 'is-active' : ''}"
            role="button"
            tabindex="0"
            title={`${node.folderPath} (${node.count})`}
            onclick={() => onSelectFolder(collection, node.folderPath)}
            onkeydown={(event) => handleKey(event, () => onSelectFolder(collection, node.folderPath))}
        >
            <button
                type="button"
                class="shrink-0 w-4 h-4 flex items-center justify-center rounded-md text-neutral-400 hover:text-(--primary) cursor-pointer {hasChildren ? '' : 'invisible'}"
                title={expanded ? "收起" : "展开"}
                aria-label={expanded ? "收起子文件夹" : "展开子文件夹"}
                onclick={(event) => {
                    event.stopPropagation();
                    onToggleExpand(collection, node.folderPath);
                }}
            >
                <Icon
                    icon={expanded ? "material-symbols:keyboard-arrow-down" : "material-symbols:keyboard-arrow-right"}
                    class="text-base"
                />
            </button>

            <Icon
                icon={expanded ? "material-symbols:folder-open-outline" : "material-symbols:folder-outline"}
                class="text-base shrink-0 opacity-80"
            />

            <span class="truncate mr-auto text-left">{node.name}</span>

            {#if node.count > 0}
                <span class="console-count-badge ml-2 shrink-0">{node.count}</span>
            {/if}
        </div>

        {#if expanded && hasChildren}
            <div class="min-w-0 flex flex-col pl-2 ml-3 border-l border-(--line-divider)">
                {#each node.children || [] as child}
                    {#if child.type === "entry"}
                        {@render renderEntry(child)}
                    {:else}
                        {@render renderFolder(collection, child)}
                    {/if}
                {/each}
            </div>
        {/if}
    </div>
{/snippet}

{#snippet renderCollection(node: SiteDirectoryNode)}
    {@const collection = node.collection}
    {@const expanded = isExpanded(collection, "")}
    {@const isActive = selectedCollection === collection && selectedFolderPath === null}
    <div class="min-w-0">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="console-row group/collection {isActive ? 'is-active' : ''}"
            role="button"
            tabindex="0"
            title={`${node.label} (${node.count})`}
            onclick={() => onSelectCollection(collection)}
            onkeydown={(event) => handleKey(event, () => onSelectCollection(collection))}
        >
            <button
                type="button"
                class="shrink-0 w-4 h-4 flex items-center justify-center rounded-md text-neutral-400 hover:text-(--primary) cursor-pointer"
                title={expanded ? "收起集合" : "展开集合"}
                aria-label={expanded ? "收起集合" : "展开集合"}
                onclick={(event) => {
                    event.stopPropagation();
                    onToggleExpand(collection, "");
                }}
            >
                <Icon
                    icon={expanded ? "material-symbols:keyboard-arrow-down" : "material-symbols:keyboard-arrow-right"}
                    class="text-base"
                />
            </button>

            <Icon icon="material-symbols:library-books-outline" class="text-base shrink-0 opacity-80" />

            <span class="truncate mr-auto text-left font-semibold">{node.label}</span>

            {#if node.count > 0}
                <span class="console-count-badge ml-2 shrink-0">{node.count}</span>
            {/if}
        </div>

        {#if expanded && (node.children || []).length > 0}
            <div class="min-w-0 flex flex-col pl-2 ml-3 border-l border-(--line-divider)">
                {#each node.children || [] as child}
                    {#if child.type === "entry"}
                        {@render renderEntry(child)}
                    {:else}
                        {@render renderFolder(collection, child)}
                    {/if}
                {/each}
            </div>
        {/if}
    </div>
{/snippet}

<div class="space-y-0.5">
    <!-- 全部内容 (当前集合) -->
    <div
        class="console-row {selectedFolderPath === null ? 'is-active' : ''}"
        role="button"
        tabindex="0"
        onclick={() => onSelectCollection(selectedCollection)}
        onkeydown={(event) => handleKey(event, () => onSelectCollection(selectedCollection))}
    >
        <span class="w-4 h-4 shrink-0"></span>
        <Icon icon="material-symbols:article-outline" class="text-base shrink-0 opacity-80" />
        <span class="truncate mr-auto text-left">当前集合全部内容</span>
        <button
            type="button"
            class="shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-neutral-400 hover:text-(--primary) cursor-pointer"
            title={includeSubfolders ? "当前包含子文件夹, 点击仅在当前层筛选" : "当前仅当前层, 点击包含子文件夹"}
            aria-label="切换是否包含子文件夹"
            onclick={(event) => {
                event.stopPropagation();
                onToggleIncludeSubfolders();
            }}
        >
            <Icon
                icon={includeSubfolders ? "material-symbols:filter-list" : "material-symbols:filter-list-off"}
                class="text-sm"
            />
        </button>
    </div>

    <!-- 6 个根集合 (与首页「目录」面板同源) -->
    {#each tree as node}
        {@render renderCollection(node)}
    {/each}

    <!-- 未归档 (当前集合根目录) -->
    <div
        class="console-row {selectedFolderPath === '' ? 'is-active' : ''}"
        role="button"
        tabindex="0"
        onclick={() => onSelectUnfiled(selectedCollection)}
        onkeydown={(event) => handleKey(event, () => onSelectUnfiled(selectedCollection))}
    >
        <span class="w-4 h-4 shrink-0"></span>
        <Icon icon="material-symbols:folder-off-outline" class="text-base shrink-0 opacity-80" />
        <span class="truncate mr-auto text-left">未归档</span>
    </div>

    <!-- 回收站 (仅文章集合) -->
    <div
        class="console-row {selectedFolderPath === '__recycle__' ? 'is-active' : ''}"
        role="button"
        tabindex="0"
        onclick={onSelectRecycle}
        onkeydown={(event) => handleKey(event, onSelectRecycle)}
    >
        <span class="w-4 h-4 shrink-0"></span>
        <Icon icon="material-symbols:delete-outline" class="text-base shrink-0 opacity-80" />
        <span class="truncate mr-auto text-left">回收站</span>
        {#if recycleCount > 0}
            <span class="console-count-badge ml-2 shrink-0">{recycleCount}</span>
        {/if}
    </div>
</div>
