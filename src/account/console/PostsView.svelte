<script lang="ts">
import { blogStore, RECYCLE_PATH } from "../store.svelte";
import { authStore } from "../auth.svelte";
import {
    exportPostFile,
    downloadTextFile,
    CONTENT_FORMAT_LABEL,
    normalizeContentFormat,
} from "../markdown";
import { createZipBlob, downloadBlob, type ZipEntry } from "../zip";
import { openConsolePreview } from "../preview";
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";
import FolderTree from "./FolderTree.svelte";
import FolderDialog, { type FolderDialogMode, type FolderDialogResult } from "./FolderDialog.svelte";
import CollectionEntriesView from "./CollectionEntriesView.svelte";
import CollectionEntryEditor from "./CollectionEntryEditor.svelte";
import type { Post } from "../types";
import type { SiteCollectionKey, SiteDirectoryNode } from "@utils/contentCollections";
import { getCollectionSchema } from "@utils/contentSchemas";
import type { SiteIndexEntry } from "../contentIndex";

let { onEditPost } = $props<{
    onEditPost: (postId: string) => void;
}>();

let actionToast = $state<string | null>(null);
let pendingPostIds: string[] = [];

interface DialogState {
    mode: FolderDialogMode;
    folderPath?: string | null;
    folderCount?: number;
    entryCount?: number;
    defaultParentPath?: string;
    defaultTargetPath?: string;
    entry?: SiteIndexEntry | null;
}

let dialog = $state<DialogState | null>(null);

interface EntryEditorState {
    collection: SiteCollectionKey;
    relPath: string | null;
    data: Record<string, unknown>;
    title: string;
}

let entryEditor = $state<EntryEditorState | null>(null);
let entrySaving = $state(false);
let entryError = $state<string | null>(null);

function showToast(msg: string) {
    actionToast = msg;
    setTimeout(() => {
        actionToast = null;
    }, 2800);
}

const collectionLabel = $derived(blogStore.currentCollectionLabel);
const collectionRoot = $derived(blogStore.currentCollectionInfo?.root || `src/content/${blogStore.selectedCollection}`);
const isPosts = $derived(blogStore.selectedCollection === "posts");

/* -------------------------------------------------------------------------- */
/* 集合与文件夹选择                                                            */
/* -------------------------------------------------------------------------- */

function handleSelectCollection(collection: SiteCollectionKey) {
    blogStore.selectCollection(collection);
}

function handleSelectFolder(collection: SiteCollectionKey, folderPath: string) {
    if (collection !== blogStore.selectedCollection) {
        blogStore.selectCollection(collection);
    }
    if (blogStore.postStatusFilter === "recycle") blogStore.postStatusFilter = "all";
    blogStore.selectedFolderPath = folderPath;
}

function handleSelectUnfiled(collection: SiteCollectionKey) {
    if (collection !== blogStore.selectedCollection) {
        blogStore.selectCollection(collection);
    }
    blogStore.selectedFolderPath = "";
}

function handleSelectRecycle() {
    blogStore.selectCollection("posts");
    blogStore.selectedFolderPath = null;
    blogStore.postStatusFilter = "recycle";
}

function openCreateFolder(parentPath?: string) {
    dialog = {
        mode: "create",
        defaultParentPath:
            parentPath ??
            (blogStore.selectedFolderPath && blogStore.selectedFolderPath !== RECYCLE_PATH
                ? blogStore.selectedFolderPath
                : ""),
    };
}

function openRenameFolder(path: string) {
    dialog = { mode: "rename", folderPath: path };
}

function openCopyFolder(path: string) {
    dialog = { mode: "copy", folderPath: path };
}

function openMoveFolder(path: string) {
    dialog = {
        mode: "move-folder",
        folderPath: path,
        defaultTargetPath: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
    };
}

function openDeleteFolder(path: string) {
    dialog = { mode: "delete", folderPath: path };
}

function openMovePost(post: Post) {
    pendingPostIds = [post.id];
    dialog = {
        mode: "move-entry",
        entryCount: 1,
        defaultTargetPath: post.folderPath || "",
    };
}

function openMoveEntry(entry: SiteIndexEntry) {
    dialog = {
        mode: "move-entry",
        entryCount: 1,
        defaultTargetPath: entry.folderPath || "",
    };
}

async function handleDialogConfirm(result: FolderDialogResult) {
    const current = dialog;
    if (!current) return;
    const collection = blogStore.selectedCollection;

    switch (current.mode) {
        case "create": {
            const created = await blogStore.createFolder({
                name: result.name,
                parentPath: result.parentPath,
                collection,
            });
            if (!created.ok) {
                showToast(`创建失败: ${created.error}`);
                return;
            }
            if (created.folder) blogStore.selectedFolderPath = created.folder.path;
            showToast(`已创建文件夹 ${result.parentPath ? result.parentPath + "/" : ""}${result.name}`);
            break;
        }
        case "rename": {
            if (!current.folderPath) return;
            const renamed = await blogStore.renameFolder(collection, current.folderPath, result.name);
            if (!renamed.ok) {
                showToast(`重命名失败: ${renamed.error}`);
                return;
            }
            if (blogStore.selectedFolderPath === current.folderPath && renamed.path) {
                blogStore.selectedFolderPath = renamed.path;
            }
            showToast(`文件夹已重命名为 ${result.name}`);
            break;
        }
        case "copy": {
            if (!current.folderPath) return;
            const copied = await blogStore.copyFolder(collection, current.folderPath, result.name);
            showToast(copied.ok ? `已复制为 ${copied.path}` : `复制失败: ${copied.error}`);
            if (!copied.ok) return;
            break;
        }
        case "move-folder": {
            if (!current.folderPath) return;
            const moved = await blogStore.moveFolder(collection, current.folderPath, result.targetPath);
            if (!moved.ok) {
                showToast(`移动失败: ${moved.error}`);
                return;
            }
            showToast(`文件夹已移动到 ${result.targetPath || collectionLabel + " 根目录"}`);
            break;
        }
        case "move-entry": {
            if (current.entry) {
                const moved = await blogStore.moveEntry(current.entry.collection, current.entry.relPath, result.targetPath);
                showToast(moved.ok ? `条目已移动` : `移动失败: ${moved.error}`);
            } else if (pendingPostIds.length > 0) {
                const moved = await blogStore.movePosts(pendingPostIds, result.targetPath);
                showToast(moved > 0 ? `已移动 ${moved} 篇文章` : "文章已在该文件夹中");
            }
            pendingPostIds = [];
            break;
        }
        case "delete": {
            if (!current.folderPath) return;
            const deleted = await blogStore.deleteFolder(
                collection,
                current.folderPath,
                result.keepEntries ? "keep-posts" : "delete-posts",
            );
            showToast(deleted.ok ? `已删除文件夹 ${current.folderPath}` : `删除失败: ${deleted.error}`);
            break;
        }
    }

    dialog = null;
}

async function handleSyncSiteDirectory() {
    const result = await blogStore.syncSiteDirectory();
    if (result.folders === 0 && result.linked === 0) {
        showToast("未能获取站点内容索引, 已保留本地文件夹");
    } else {
        showToast(
            `已同步站点目录: 文件夹 ${blogStore.folders.length} 个, 对齐文章 ${result.linked} 篇${result.writable ? " (可写回)" : " (只读)"}`,
        );
    }
}

/* -------------------------------------------------------------------------- */
/* 文章                                                                        */
/* -------------------------------------------------------------------------- */

function handleExportPost(post: Post) {
    const file = exportPostFile(post, normalizeContentFormat(post.contentFormat), blogStore.categoriesMap, blogStore.tagsMap);
    downloadTextFile(file.filename, file.content);
    showToast(`已导出 ${file.filename} → 目标路径 src/content/posts/${file.path}`);
}

function handleExportCurrentFolderAsZip() {
    const posts = blogStore.filteredPosts;
    if (posts.length === 0) return;
    const entries: ZipEntry[] = posts.map((post) => {
        const file = exportPostFile(post, normalizeContentFormat(post.contentFormat), blogStore.categoriesMap, blogStore.tagsMap);
        return { path: file.path, content: file.content };
    });
    const scope = blogStore.selectedFolderPath === null ? "all-posts" : (blogStore.selectedFolderPath || "root");
    const zipName = `mc00-posts-${scope.replace(/\//g, "-")}.zip`;
    downloadBlob(zipName, createZipBlob(entries));
    showToast(`已打包 ${entries.length} 篇文章 (保留目录层级) → ${zipName}`);
}

function canManagePost(post: Post): boolean {
    if (authStore.can("posts:*") || authStore.can("posts:edit:all")) return true;
    if (authStore.can("posts:edit:own") && post.authorId === authStore.currentUser?.id) return true;
    return false;
}

function handleCreateNew(folderPath?: string) {
    blogStore.startEditing(null, folderPath ?? (blogStore.selectedFolderPath && blogStore.selectedFolderPath !== RECYCLE_PATH ? blogStore.selectedFolderPath : ""));
    onEditPost("");
}

/** 预览: 站点真实文章打开真实前台路由, 仅存在于控制台的稿件走整页预览 */
function handlePreview(post: Post) {
    const siteUrl = blogStore.resolvePostUrl(post);
    if (siteUrl) {
        window.open(siteUrl, "_blank");
        return;
    }
    openConsolePreview({
        title: post.title,
        slug: post.slug,
        format: normalizeContentFormat(post.contentFormat),
        content: post.content,
        summary: post.summary || post.excerpt || "",
        cover: post.cover || "",
        status: post.status,
        categories: post.categories.map((id) => blogStore.categoriesMap.get(id) || id),
        tags: post.tags.map((id) => blogStore.tagsMap.get(id) || id),
        author: post.authorName,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        wordCount: post.wordCount,
        readingTime: post.readingTime,
        folderPath: post.folderPath || "",
    });
    showToast("该文章尚未同步到站点, 已打开控制台整页预览");
}

function handleEmptyRecycle() {
    const recyclePosts = blogStore.posts.filter((p) => p.status === "recycle");
    if (recyclePosts.length === 0) return;
    if (confirm(`确定要彻底清空回收站中的 ${recyclePosts.length} 篇文章吗？此操作不可撤销！`)) {
        for (const p of recyclePosts) {
            blogStore.deletePostPermanently(p.id);
        }
        showToast("已清空回收站");
    }
}

/* -------------------------------------------------------------------------- */
/* 集合条目                                                                    */
/* -------------------------------------------------------------------------- */

/** 打开目录树中的条目 */
async function handleOpenTreeEntry(node: SiteDirectoryNode) {
    if (node.collection === "posts") {
        const post = blogStore.posts.find((item) => item.contentId === node.entryId);
        if (post) {
            onEditPost(post.id);
            return;
        }
    }
    const entry = blogStore.siteEntries.find(
        (item) => item.collection === node.collection && item.relPath === node.path.slice(node.collection.length + 1),
    );
    if (entry) await handleEditEntry(entry);
}

async function handleEditEntry(entry: SiteIndexEntry) {
    const loaded = await blogStore.loadEntryContent(entry.collection, entry.relPath);
    if (!loaded.ok) {
        showToast(`读取失败: ${loaded.error}`);
        return;
    }
    entryError = null;
    entryEditor = {
        collection: entry.collection,
        relPath: entry.relPath,
        data: (loaded.data as Record<string, unknown>) || (entry.meta as Record<string, unknown>),
        title: `编辑 ${entry.name}`,
    };
}

function handleCreateEntry() {
    const template = blogStore.entryTemplate(blogStore.selectedCollection);
    if (!template) {
        showToast("该集合不支持在此新建条目");
        return;
    }
    entryError = null;
    entryEditor = {
        collection: blogStore.selectedCollection,
        relPath: null,
        data: template,
        title: `新建 ${collectionLabel} 条目`,
    };
}

async function handleSaveEntry(data: Record<string, unknown>) {
    const current = entryEditor;
    if (!current) return;
    entrySaving = true;
    entryError = null;

    const folder =
        blogStore.selectedFolderPath && blogStore.selectedFolderPath !== RECYCLE_PATH
            ? blogStore.selectedFolderPath
            : "";

    const result = current.relPath
        ? await blogStore.saveEntry(current.collection, current.relPath, { data })
        : await blogStore.createEntry(current.collection, folder, data);

    entrySaving = false;
    if (!result.ok) {
        entryError = result.error || "保存失败";
        return;
    }
    entryEditor = null;
    showToast(`已写入 src/content/${current.collection}/${result.relPath || current.relPath}`);
}

async function handleDeleteEntry(entry: SiteIndexEntry) {
    if (!confirm(`确定要删除条目「${entry.name}」吗？将移除文件 src/content/${entry.collection}/${entry.relPath}`)) return;
    const result = await blogStore.deleteEntry(entry.collection, entry.relPath);
    showToast(result.ok ? `已删除 ${entry.relPath}` : `删除失败: ${result.error}`);
}

async function handleExportEntry(entry: SiteIndexEntry) {
    const loaded = await blogStore.loadEntryContent(entry.collection, entry.relPath);
    const data = loaded.ok && loaded.data ? loaded.data : entry.meta;
    downloadTextFile(`${entry.id.split("/").pop()}.json`, JSON.stringify(data, null, 4) + "\n");
    showToast(`已导出 ${entry.relPath}`);
}

function handlePreviewEntry(entry: SiteIndexEntry) {
    if (entry.url) {
        window.open(entry.url, "_blank");
        return;
    }
    showToast("该集合没有独立前台页面");
}

const entrySchema = $derived(entryEditor ? getCollectionSchema(entryEditor.collection) : null);
</script>

{#if actionToast}
    <div class="fixed top-6 right-8 z-50 px-4 py-2 rounded-2xl card-base liquid-glass text-neutral-900 dark:text-white border border-(--primary)/40 shadow-2xl backdrop-blur-xl text-xs font-mono flex items-center gap-2 animate-in fade-in zoom-in-95 pointer-events-none">
        <span class="w-2 h-2 rounded-full bg-(--primary) animate-pulse"></span>
        <span>{actionToast}</span>
    </div>
{/if}

<div class="space-y-4 select-none text-neutral-900 dark:text-neutral-100">
    <!-- 顶部状态栏与筛选器 -->
    <div class="card-base liquid-glass rounded-3xl p-5 sm:p-6 border border-black/5 dark:border-white/8 shadow-xl space-y-4">
        <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <!-- 状态 Tabs 胶囊组 (仅文章集合) -->
            <div class="card-base liquid-glass p-1 flex items-center gap-1 overflow-x-auto shadow-xs rounded-full border border-black/5 dark:border-white/8 shrink-0">
                <button
                    type="button"
                    class="console-chip {blogStore.postStatusFilter === 'all' ? 'is-active' : ''}"
                    onclick={() => { blogStore.selectedCollection = 'posts'; blogStore.postStatusFilter = 'all'; }}
                >
                    全部 ({blogStore.stats.totalPosts})
                </button>
                <button
                    type="button"
                    class="console-chip {blogStore.postStatusFilter === 'published' ? 'is-active' : ''}"
                    onclick={() => { blogStore.selectedCollection = 'posts'; blogStore.postStatusFilter = 'published'; }}
                >
                    已发布 ({blogStore.stats.publishedCount})
                </button>
                <button
                    type="button"
                    class="console-chip {blogStore.postStatusFilter === 'draft' ? 'is-active' : ''}"
                    onclick={() => { blogStore.selectedCollection = 'posts'; blogStore.postStatusFilter = 'draft'; }}
                >
                    草稿箱 ({blogStore.stats.draftCount})
                </button>
                <button
                    type="button"
                    class="console-chip is-danger {blogStore.postStatusFilter === 'recycle' ? 'is-active' : ''}"
                    onclick={handleSelectRecycle}
                >
                    回收站 ({blogStore.stats.recycleCount})
                </button>
            </div>

            <!-- 搜索与筛选工具条 -->
            <div class="flex items-center gap-2.5 flex-wrap">
                {#if isPosts}
                    <select
                        class="console-field cursor-pointer"
                        value={blogStore.postCategoryFilter}
                        onchange={(e) => (blogStore.postCategoryFilter = (e.target as HTMLSelectElement).value)}
                    >
                        <option value="all">全部分类</option>
                        {#each blogStore.categories as cat}
                            <option value={cat.id}>{cat.name}</option>
                        {/each}
                    </select>

                    <div class="relative flex-1 sm:flex-initial">
                        <input
                            type="text"
                            placeholder="搜索标题 / Slug..."
                            class="console-field pl-8 w-full sm:w-56"
                            bind:value={blogStore.postSearchKeyword}
                        />
                        <Icon icon="material-symbols:search" class="absolute left-2.5 top-2 text-neutral-400 text-sm pointer-events-none" />
                    </div>
                {/if}

                {#if isPosts && blogStore.postStatusFilter === 'recycle' && blogStore.stats.recycleCount > 0}
                    <Button
                        variant="danger"
                        size="sm"
                        icon="material-symbols:delete-forever"
                        label="清空回收站"
                        onclick={handleEmptyRecycle}
                    />
                {/if}

                {#if isPosts && blogStore.filteredPosts.length > 0}
                    <Button
                        variant="secondary"
                        size="sm"
                        icon="material-symbols:download"
                        label="导出 .zip"
                        title="按文件夹层级打包导出当前筛选结果"
                        onclick={handleExportCurrentFolderAsZip}
                    />
                {/if}

                {#if isPosts && authStore.can("posts:create")}
                    <Button
                        variant="primary"
                        size="sm"
                        icon="material-symbols:edit-note"
                        label="写文章"
                        onclick={() => handleCreateNew()}
                    />
                {/if}
            </div>
        </div>

        <!-- 写回能力状态条 -->
        <div class="flex items-center justify-between gap-3 p-2.5 rounded-2xl border {blogStore.contentWritable ? 'bg-emerald-500/8 border-emerald-500/25' : 'bg-amber-500/8 border-amber-500/25'}">
            <div class="flex items-center gap-2 text-[11px] min-w-0">
                <Icon
                    icon={blogStore.contentWritable ? "material-symbols:cloud-done-outline" : "material-symbols:cloud-off-outline"}
                    class="text-base shrink-0 {blogStore.contentWritable ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}"
                />
                <span class="font-semibold shrink-0 {blogStore.contentWritable ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}">
                    {blogStore.contentWritable ? "真实写回已开启" : "只读模式"}
                </span>
                <span class="text-neutral-500 dark:text-neutral-400 truncate" title={blogStore.contentWriteReason}>
                    {blogStore.contentWriteReason || "正在探测内容服务..."}
                </span>
            </div>
            <Button
                variant="ghost"
                size="sm"
                icon={blogStore.siteSyncing ? "material-symbols:sync" : "material-symbols:cloud-sync-outline"}
                label="重新同步"
                title="从站点真实内容目录重新同步集合与文件夹"
                onclick={handleSyncSiteDirectory}
            />
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[19rem_minmax(0,1fr)] gap-4 items-start">
        <!-- 左栏: 内容集合目录树 (与首页「目录」面板同源) -->
        <div class="card-base liquid-glass rounded-3xl p-4 border border-black/5 dark:border-white/8 shadow-xl space-y-3 lg:sticky lg:top-4">
            <div class="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
                <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-(--primary) before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2">
                    <h3 class="text-sm font-bold text-neutral-900 dark:text-white">内容集合</h3>
                </div>
                <span class="text-[10px] text-neutral-400 font-mono">{blogStore.siteEntries.length} 条目</span>
            </div>

            <FolderTree
                tree={blogStore.consoleTree}
                selectedCollection={blogStore.selectedCollection}
                selectedFolderPath={blogStore.postStatusFilter === 'recycle' ? RECYCLE_PATH : blogStore.selectedFolderPath}
                includeSubfolders={blogStore.includeSubfolders}
                recycleCount={blogStore.stats.recycleCount}
                isExpanded={(collection, path) => blogStore.isFolderExpanded(collection, path)}
                onToggleExpand={(collection, path) => blogStore.toggleFolderExpanded(collection, path)}
                onSelectCollection={handleSelectCollection}
                onSelectFolder={handleSelectFolder}
                onSelectUnfiled={handleSelectUnfiled}
                onSelectRecycle={handleSelectRecycle}
                onToggleIncludeSubfolders={() => (blogStore.includeSubfolders = !blogStore.includeSubfolders)}
                onOpenEntry={handleOpenTreeEntry}
            />

            <div class="pt-3 border-t border-black/5 dark:border-white/5 space-y-2">
                <div class="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        class="flex-1 justify-center"
                        icon="material-symbols:create-new-folder-outline"
                        label="新建文件夹"
                        onclick={() => openCreateFolder()}
                    />
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        icon="material-symbols:unfold-more"
                        title="全部展开"
                        aria-label="全部展开"
                        onclick={() => blogStore.expandAllFolders()}
                    />
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        icon="material-symbols:unfold-less"
                        title="全部收起"
                        aria-label="全部收起"
                        onclick={() => blogStore.collapseAllFolders()}
                    />
                </div>

                {#if blogStore.selectedFolder && blogStore.selectedFolderPath !== null}
                    <div class="p-2 rounded-2xl bg-black/2 dark:bg-white/3 border border-black/5 dark:border-white/5 space-y-2">
                        <div class="text-[10.5px] font-mono text-neutral-400 truncate" title={blogStore.selectedFolder.path}>
                            {collectionRoot}/{blogStore.selectedFolder.path}
                        </div>
                        <div class="flex flex-wrap items-center gap-1.5">
                            {#if isPosts}
                                <Button
                                    variant="primary"
                                    size="sm"
                                    icon="material-symbols:note-add"
                                    label="在此新建文章"
                                    onclick={() => handleCreateNew(blogStore.selectedFolder?.path || "")}
                                />
                            {/if}
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                icon="material-symbols:create-new-folder-outline"
                                title="新建子文件夹"
                                aria-label="新建子文件夹"
                                onclick={() => openCreateFolder(blogStore.selectedFolderPath || "")}
                            />
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                icon="material-symbols:edit-outline"
                                title="重命名"
                                aria-label="重命名文件夹"
                                onclick={() => blogStore.selectedFolderPath !== null && openRenameFolder(blogStore.selectedFolderPath)}
                            />
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                icon="material-symbols:content-copy-outline"
                                title="复制"
                                aria-label="复制文件夹"
                                onclick={() => blogStore.selectedFolderPath !== null && openCopyFolder(blogStore.selectedFolderPath)}
                            />
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                icon="material-symbols:drive-file-move-outline"
                                title="移动"
                                aria-label="移动文件夹"
                                onclick={() => blogStore.selectedFolderPath !== null && openMoveFolder(blogStore.selectedFolderPath)}
                            />
                            <Button
                                variant="danger"
                                size="icon-sm"
                                icon="material-symbols:delete-outline"
                                title="删除"
                                aria-label="删除文件夹"
                                onclick={() => blogStore.selectedFolderPath !== null && openDeleteFolder(blogStore.selectedFolderPath)}
                            />
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <!-- 右栏: 文章列表 或 集合条目列表 -->
        {#if isPosts}
            <div class="space-y-3.5 min-w-0">
                {#if blogStore.filteredPosts.length === 0}
                    <div class="card-base liquid-glass rounded-3xl p-16 text-center text-neutral-400 text-xs border border-black/5 dark:border-white/8 shadow-xl">
                        <Icon icon="material-symbols:inbox-outline" class="text-4xl mx-auto mb-3 opacity-40 text-(--primary)" />
                        <p class="font-medium text-sm text-neutral-700 dark:text-neutral-300">暂无符合筛选条件的文章</p>
                        <p class="text-neutral-400 text-[11px] mt-1">尝试切换状态过滤条件、切换文件夹或搜索其他关键词</p>
                        {#if authStore.can("posts:create")}
                            <div class="mt-4 flex justify-center">
                                <Button
                                    variant="primary"
                                    size="md"
                                    icon="material-symbols:add"
                                    label="立即创作第一篇博文"
                                    onclick={() => handleCreateNew()}
                                />
                            </div>
                        {/if}
                    </div>
                {:else}
                    {#each blogStore.filteredPosts as post}
                        <div class="card-base liquid-glass rounded-2xl p-4 sm:p-5 border border-black/5 dark:border-white/8 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group hover:border-(--primary)/40 transition-all">
                            <div class="flex items-start gap-4 min-w-0 flex-1">
                                {#if post.cover}
                                    <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border border-black/8 dark:border-white/10 hidden sm:block">
                                        <img src={post.cover} alt={post.title} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    </div>
                                {/if}

                                <div class="min-w-0 flex-1 space-y-1.5">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        {#if post.pinned}
                                            <span class="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/25">
                                                置顶
                                            </span>
                                        {/if}
                                        <span class={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                            post.status === 'published'
                                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                                                : post.status === 'draft'
                                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'
                                                : 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border-neutral-500/25'
                                        }`}>
                                            {post.status === 'published' ? '已发布' : post.status === 'draft' ? '草稿' : '回收站'}
                                        </span>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-(--primary)/25 bg-(--primary)/10 text-(--primary)">
                                            {CONTENT_FORMAT_LABEL[normalizeContentFormat(post.contentFormat)]}
                                        </span>
                                        <h3 class="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-(--primary) transition-colors truncate">
                                            {post.title}
                                        </h3>
                                    </div>

                                    <p class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
                                        {post.summary || post.excerpt || "暂无内容描述..."}
                                    </p>

                                    <div class="flex items-center gap-3 sm:gap-4 text-[11px] text-neutral-400 flex-wrap font-mono pt-1">
                                        <span>文件夹: <span class="text-(--primary)">{post.folderPath || "根目录"}</span></span>
                                        <span>Slug: <span class="text-neutral-700 dark:text-neutral-300">{post.slug}</span></span>
                                        <span>字数: <span class="text-neutral-700 dark:text-neutral-300">{post.wordCount || 0}</span></span>
                                        <span>更新: <span class="text-neutral-700 dark:text-neutral-300">{post.updatedAt?.split('T')[0] || post.createdAt?.split('T')[0]}</span></span>
                                        {#if post.categories && post.categories.length > 0}
                                            <span>分类: <span class="text-(--primary)">{post.categories.map((c) => blogStore.categoriesMap.get(c) || c).join(', ')}</span></span>
                                        {/if}
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end pt-3 md:pt-0 border-t md:border-t-0 border-black/5 dark:border-white/5">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon="material-symbols:visibility"
                                    label="预览"
                                    title="真实文章打开前台页面, 未发布稿件打开整页预览"
                                    onclick={() => handlePreview(post)}
                                />

                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon="material-symbols:download"
                                    label="导出"
                                    title="按当前格式导出到 文件夹/slug 路径"
                                    onclick={() => handleExportPost(post)}
                                />

                                {#if canManagePost(post)}
                                    {#if post.status !== 'recycle'}
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            icon="material-symbols:drive-file-move-outline"
                                            title="移动到文件夹"
                                            aria-label="移动到文件夹"
                                            onclick={() => openMovePost(post)}
                                        />

                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            icon="material-symbols:push-pin"
                                            title={post.pinned ? "取消置顶" : "设为置顶"}
                                            aria-label={post.pinned ? "取消置顶" : "设为置顶"}
                                            active={post.pinned}
                                            onclick={() => {
                                                blogStore.togglePin(post.id);
                                                showToast(post.pinned ? "已取消置顶" : "已设为置顶");
                                            }}
                                        />

                                        <Button
                                            variant="primary"
                                            size="sm"
                                            icon="material-symbols:edit-document-outline"
                                            label="编辑"
                                            onclick={() => onEditPost(post.id)}
                                        />

                                        <Button
                                            variant="danger"
                                            size="icon-sm"
                                            icon="material-symbols:delete-outline"
                                            title="移入回收站"
                                            aria-label="移入回收站"
                                            onclick={() => {
                                                blogStore.moveToRecycle(post.id);
                                                showToast("文章已移入回收站");
                                            }}
                                        />
                                    {:else}
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            label="恢复为草稿"
                                            onclick={() => {
                                                blogStore.restoreFromRecycle(post.id);
                                                showToast("文章已恢复为草稿");
                                            }}
                                        />
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            label="彻底删除"
                                            onclick={() => {
                                                if (confirm("确定要永久彻底删除该文章吗？该操作不可逆！")) {
                                                    blogStore.deletePostPermanently(post.id);
                                                    showToast("文章已彻底删除");
                                                }
                                            }}
                                        />
                                    {/if}
                                {/if}
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
        {:else}
            <CollectionEntriesView
                collection={blogStore.selectedCollection}
                collectionLabel={collectionLabel}
                entries={blogStore.currentEntries}
                writable={blogStore.contentWritable}
                onCreate={handleCreateEntry}
                onEdit={handleEditEntry}
                onDelete={handleDeleteEntry}
                onMove={openMoveEntry}
                onPreview={handlePreviewEntry}
                onExport={handleExportEntry}
            />
        {/if}
    </div>
</div>

{#if dialog}
    <FolderDialog
        mode={dialog.mode}
        folderPath={dialog.folderPath ?? null}
        folderCount={dialog.folderCount ?? 0}
        folderOptions={blogStore.folderOptions}
        collectionLabel={collectionLabel}
        collectionRoot={collectionRoot}
        entryCount={dialog.entryCount ?? 0}
        defaultParentPath={dialog.defaultParentPath ?? ""}
        defaultTargetPath={dialog.defaultTargetPath ?? ""}
        onConfirm={handleDialogConfirm}
        onClose={() => {
            dialog = null;
            pendingPostIds = [];
        }}
    />
{/if}

{#if entryEditor && entrySchema}
    {#key entryEditor.relPath ?? "new"}
        <CollectionEntryEditor
            schema={entrySchema}
            title={entryEditor.title}
            relPath={entryEditor.relPath}
            initialData={entryEditor.data}
            writable={blogStore.contentWritable}
            saving={entrySaving}
            error={entryError}
            onSave={handleSaveEntry}
            onClose={() => {
                entryEditor = null;
                entryError = null;
            }}
        />
    {/key}
{/if}
