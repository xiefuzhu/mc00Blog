<script lang="ts">
import { blogStore } from "../store.svelte";
import { authStore } from "../auth.svelte";
import { exportAstroMarkdown, downloadTextFile } from "../markdown";
import Icon from "@components/common/icon.svelte";
import type { Post } from "../types";

let { onEditPost } = $props<{
    onEditPost: (postId: string) => void;
}>();

let actionToast = $state<string | null>(null);

function showToast(msg: string) {
    actionToast = msg;
    setTimeout(() => {
        actionToast = null;
    }, 2500);
}

function handleExportPost(post: Post) {
    const mdContent = exportAstroMarkdown(post, blogStore.categoriesMap, blogStore.tagsMap);
    const filename = `${post.slug || 'post'}.md`;
    downloadTextFile(filename, mdContent);
    showToast(`已导出 ${filename}`);
}

function handleExportAll() {
    const postsToExport = blogStore.filteredPosts;
    if (postsToExport.length === 0) return;
    for (const post of postsToExport) {
        handleExportPost(post);
    }
    showToast(`已导出全部 ${postsToExport.length} 篇文章`);
}

function canManagePost(post: Post): boolean {
    if (authStore.can("posts:*") || authStore.can("posts:edit:all")) return true;
    if (authStore.can("posts:edit:own") && post.authorId === authStore.currentUser?.id) return true;
    return false;
}

function handleCreateNew() {
    blogStore.startEditing(null);
    onEditPost("");
}

function handleViewPost(post: Post) {
    if (typeof window !== "undefined") {
        window.open(`/posts/${post.slug}`, "_blank");
    }
}

function handleEmptyRecycle() {
    const recyclePosts = blogStore.posts.filter(p => p.status === 'recycle');
    if (recyclePosts.length === 0) return;
    if (confirm(`确定要彻底清空回收站中的 ${recyclePosts.length} 篇文章吗？此操作不可撤销！`)) {
        for (const p of recyclePosts) {
            blogStore.deletePostPermanently(p.id);
        }
        showToast("已清空回收站");
    }
}
</script>

{#if actionToast}
    <div class="fixed top-6 right-8 z-50 px-4 py-2 rounded-2xl card-base liquid-glass text-neutral-900 dark:text-white border border-(--primary)/40 shadow-2xl backdrop-blur-xl text-xs font-mono flex items-center gap-2 animate-in fade-in zoom-in-95 pointer-events-none">
        <span class="w-2 h-2 rounded-full bg-(--primary) animate-pulse"></span>
        <span>{actionToast}</span>
    </div>
{/if}

<div class="space-y-6 select-none text-neutral-900 dark:text-neutral-100">
    <!-- 顶部状态栏与筛选器 (统一现代毛玻璃规范) -->
    <div class="card-base liquid-glass rounded-3xl p-5 sm:p-6 border border-black/5 dark:border-white/8 shadow-xl space-y-4">
        <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <!-- 状态 Tabs 胶囊组 -->
            <div class="card-base liquid-glass p-1 flex items-center gap-1 overflow-x-auto shadow-xs rounded-full border border-black/5 dark:border-white/8 shrink-0">
                <button
                    type="button"
                    class="px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap {blogStore.postStatusFilter === 'all' ? 'bg-(--primary) text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}"
                    onclick={() => blogStore.postStatusFilter = 'all'}
                >
                    全部 ({blogStore.stats.totalPosts})
                </button>
                <button
                    type="button"
                    class="px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap {blogStore.postStatusFilter === 'published' ? 'bg-(--primary) text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}"
                    onclick={() => blogStore.postStatusFilter = 'published'}
                >
                    已发布 ({blogStore.stats.publishedCount})
                </button>
                <button
                    type="button"
                    class="px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap {blogStore.postStatusFilter === 'draft' ? 'bg-(--primary) text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}"
                    onclick={() => blogStore.postStatusFilter = 'draft'}
                >
                    草稿箱 ({blogStore.stats.draftCount})
                </button>
                <button
                    type="button"
                    class="px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap {blogStore.postStatusFilter === 'recycle' ? 'bg-rose-500 text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}"
                    onclick={() => blogStore.postStatusFilter = 'recycle'}
                >
                    回收站 ({blogStore.stats.recycleCount})
                </button>
            </div>

            <!-- 搜索与筛选工具条 -->
            <div class="flex items-center gap-3 flex-wrap">
                <!-- 分类选择 -->
                <select
                    class="px-3.5 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl cursor-pointer"
                    value={blogStore.postCategoryFilter}
                    onchange={(e) => blogStore.postCategoryFilter = (e.target as HTMLSelectElement).value}
                >
                    <option value="all">全部分类</option>
                    {#each blogStore.categories as cat}
                        <option value={cat.id}>{cat.name}</option>
                    {/each}
                </select>

                <!-- 搜索框 -->
                <div class="relative flex-1 sm:flex-initial">
                    <input
                        type="text"
                        placeholder="搜索标题 / Slug..."
                        class="pl-8 pr-3 py-1.5 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl w-full sm:w-56 focus:outline-none focus:border-(--primary)/50"
                        bind:value={blogStore.postSearchKeyword}
                    />
                    <Icon icon="material-symbols:search" class="absolute left-2.5 top-2 text-neutral-400 text-sm pointer-events-none" />
                </div>

                <!-- 批量清空回收站 -->
                {#if blogStore.postStatusFilter === 'recycle' && blogStore.stats.recycleCount > 0}
                    <button
                        type="button"
                        class="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
                        onclick={handleEmptyRecycle}
                    >
                        <Icon icon="material-symbols:delete-forever" class="text-sm" />
                        <span>清空回收站</span>
                    </button>
                {/if}

                <!-- 批量导出按钮 -->
                {#if blogStore.filteredPosts.length > 0}
                    <button
                        type="button"
                        class="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 font-medium text-xs flex items-center gap-1 border border-black/8 dark:border-white/10 cursor-pointer transition-all"
                        onclick={handleExportAll}
                        title="批量导出当前筛选文章为 Markdown"
                    >
                        <Icon icon="material-symbols:download" class="text-sm text-(--primary)" />
                        <span class="hidden sm:inline">导出</span>
                    </button>
                {/if}

                <!-- 撰写文章按钮 (高光胶囊按钮) -->
                {#if authStore.can("posts:create")}
                    <button
                        type="button"
                        class="px-4 py-1.5 rounded-xl bg-(--primary) hover:brightness-110 text-white font-bold text-xs flex items-center gap-1.5 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
                        onclick={handleCreateNew}
                    >
                        <Icon icon="material-symbols:edit-note" class="text-base" />
                        <span>写文章</span>
                    </button>
                {/if}
            </div>
        </div>
    </div>

    <!-- 文章列表主体 -->
    {#if blogStore.filteredPosts.length === 0}
        <div class="card-base liquid-glass rounded-3xl p-16 text-center text-neutral-400 text-xs border border-black/5 dark:border-white/8 shadow-xl">
            <Icon icon="material-symbols:inbox-outline" class="text-4xl mx-auto mb-3 opacity-40 text-(--primary)" />
            <p class="font-medium text-sm text-neutral-700 dark:text-neutral-300">暂无符合筛选条件的文章</p>
            <p class="text-neutral-400 text-[11px] mt-1">尝试切换状态过滤条件或搜索其他关键词</p>
            {#if authStore.can("posts:create")}
                <button
                    type="button"
                    class="mt-4 px-5 py-2.5 rounded-xl bg-(--primary) text-white font-bold text-xs transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-md inline-flex items-center gap-1.5"
                    onclick={handleCreateNew}
                >
                    <Icon icon="material-symbols:add" class="text-base" />
                    <span>立即创作第一篇博文</span>
                </button>
            {/if}
        </div>
    {:else}
        <div class="space-y-3.5">
            {#each blogStore.filteredPosts as post}
                <div class="card-base liquid-glass rounded-2xl p-4 sm:p-5 border border-black/5 dark:border-white/8 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group hover:border-(--primary)/40 transition-all">
                    <!-- 文章封面与主要信息 -->
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
                                <h3 class="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                                    {post.title}
                                </h3>
                            </div>

                            <p class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
                                {post.summary || post.excerpt || "暂无内容描述..."}
                            </p>

                            <div class="flex items-center gap-3 sm:gap-4 text-[11px] text-neutral-400 dark:text-neutral-400 flex-wrap font-mono pt-1">
                                <span>Slug: <span class="text-neutral-700 dark:text-neutral-300">{post.slug}</span></span>
                                <span>作者: <span class="text-neutral-700 dark:text-neutral-300">{post.authorName || '管理员'}</span></span>
                                <span>字数: <span class="text-neutral-700 dark:text-neutral-300">{post.wordCount || 0}</span></span>
                                <span>更新: <span class="text-neutral-700 dark:text-neutral-300">{post.updatedAt?.split('T')[0] || post.createdAt?.split('T')[0]}</span></span>
                                {#if post.categories && post.categories.length > 0}
                                    <span>分类: <span class="text-emerald-600 dark:text-emerald-400">{post.categories.map(c => blogStore.categoriesMap.get(c)?.name || c).join(', ')}</span></span>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <!-- 操作动作按钮组 -->
                    <div class="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end pt-3 md:pt-0 border-t md:border-t-0 border-black/5 dark:border-white/5">
                        <!-- 前台预览 -->
                        <button
                            type="button"
                            class="px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1 border border-black/5 dark:border-white/5 cursor-pointer"
                            onclick={() => handleViewPost(post)}
                            title="在前台页面打开预览"
                        >
                            <Icon icon="material-symbols:open-in-new" class="text-sm text-blue-500" />
                            <span class="hidden sm:inline">预览</span>
                        </button>

                        <!-- 导出为 Astro Markdown -->
                        <button
                            type="button"
                            class="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 border border-black/5 dark:border-white/5 cursor-pointer"
                            onclick={() => handleExportPost(post)}
                            title="导出为标准 Astro Markdown 文件"
                        >
                            <Icon icon="material-symbols:download" class="text-sm text-emerald-500" />
                            <span>导出 .md</span>
                        </button>

                        {#if canManagePost(post)}
                            {#if post.status !== 'recycle'}
                                <!-- 置顶切换 -->
                                <button
                                    type="button"
                                    class="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/5 dark:border-white/5 text-xs transition-colors cursor-pointer"
                                    onclick={() => {
                                        blogStore.togglePin(post.id);
                                        showToast(post.pinned ? "已取消置顶" : "已设为置顶");
                                    }}
                                    title={post.pinned ? "取消置顶" : "设为置顶"}
                                >
                                    <Icon icon="material-symbols:push-pin" class={`text-sm ${post.pinned ? 'text-rose-500' : 'text-neutral-400'}`} />
                                </button>

                                <!-- 编辑 -->
                                <button
                                    type="button"
                                    class="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 hover:text-neutral-950 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-all border border-emerald-500/25 flex items-center gap-1 cursor-pointer"
                                    onclick={() => onEditPost(post.id)}
                                >
                                    <Icon icon="material-symbols:edit-document-outline" class="text-sm" />
                                    <span>编辑</span>
                                </button>

                                <!-- 移入回收站 -->
                                <button
                                    type="button"
                                    class="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 dark:text-rose-400 text-xs transition-colors cursor-pointer"
                                    onclick={() => {
                                        blogStore.moveToRecycle(post.id);
                                        showToast("文章已移入回收站");
                                    }}
                                    title="移入回收站"
                                >
                                    <Icon icon="material-symbols:delete-outline" class="text-sm" />
                                </button>
                            {:else}
                                <!-- 回收站恢复 -->
                                <button
                                    type="button"
                                    class="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-xs font-medium transition-colors cursor-pointer"
                                    onclick={() => {
                                        blogStore.restoreFromRecycle(post.id);
                                        showToast("文章已恢复为草稿");
                                    }}
                                >
                                    恢复为草稿
                                </button>
                                <!-- 永久删除 -->
                                <button
                                    type="button"
                                    class="px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/25 text-xs font-medium transition-colors cursor-pointer"
                                    onclick={() => {
                                        if (confirm("确定要永久彻底删除该文章吗？该操作不可逆！")) {
                                            blogStore.deletePostPermanently(post.id);
                                            showToast("文章已彻底删除");
                                        }
                                    }}
                                >
                                    彻底删除
                                </button>
                            {/if}
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
