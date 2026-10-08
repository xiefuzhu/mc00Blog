<script lang="ts">
import { blogStore } from "../store.svelte";
import { authStore } from "../auth.svelte";
import Icon from "@components/common/icon.svelte";
import type { Attachment } from "../types";

let newAttName = $state("");
let newAttUrl = $state("");
let copyFeedback = $state<string | null>(null);
let previewImage = $state<Attachment | null>(null);

function handleAddAttachment() {
    if (!newAttName.trim() || !newAttUrl.trim()) return;
    blogStore.addAttachment({
        name: newAttName.trim(),
        url: newAttUrl.trim(),
        size: 154200,
        type: "image/webp",
        uploaderId: authStore.currentUser?.id || "u-admin",
    });
    newAttName = "";
    newAttUrl = "";
}

function handleCopyMarkdown(name: string, url: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(`![${name}](${url})`);
        copyFeedback = name;
        setTimeout(() => {
            copyFeedback = null;
        }, 2200);
    }
}

function handleDeleteAttachment(id: string) {
    if (confirm("确定要删除该媒体附件吗？")) {
        blogStore.deleteAttachment(id);
    }
}
</script>

<div class="space-y-6 select-none text-neutral-900 dark:text-neutral-100">
    <!-- 复制成功的发光提示 -->
    {#if copyFeedback}
        <div class="fixed top-8 right-8 z-50 px-4 py-2.5 rounded-2xl card-base liquid-glass text-neutral-900 dark:text-white border border-(--primary)/40 shadow-2xl backdrop-blur-md text-xs font-mono flex items-center gap-2 animate-in fade-in zoom-in-95 pointer-events-none">
            <span class="w-2 h-2 rounded-full bg-(--primary) animate-pulse"></span>
            <span>已复制 Markdown 链接: {copyFeedback}</span>
        </div>
    {/if}

    <!-- 新增素材栏 -->
    {#if authStore.can("attachments:*")}
        <div class="card-base liquid-glass p-5 sm:p-6 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl space-y-4 text-xs">
            <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-purple-500 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 pb-2 border-b border-black/5 dark:border-white/5">
                <h3 class="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <span>录入媒体附件 / 图床资源</span>
                </h3>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <input
                    type="text"
                    placeholder="文件名称 (例如: banner-wallpaper.webp)"
                    class="w-full px-3.5 py-2 text-xs card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-(--primary)/50"
                    bind:value={newAttName}
                />
                <input
                    type="text"
                    placeholder="素材在线 URL 地址 (https://...)"
                    class="w-full px-3.5 py-2 text-xs font-mono card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-(--primary)/50"
                    bind:value={newAttUrl}
                />
            </div>

            <div class="flex justify-end">
                <button
                    type="button"
                    class="px-5 py-2 rounded-xl bg-(--primary) hover:brightness-110 text-white font-bold text-xs shadow-md transition-all active:scale-98 cursor-pointer"
                    onclick={handleAddAttachment}
                >
                    确认录入附件库
                </button>
            </div>
        </div>
    {/if}

    <!-- 媒体资源网格 -->
    <div class="card-base liquid-glass p-5 sm:p-6 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl space-y-5">
        <div class="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
            <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-(--primary) before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2">
                <h3 class="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>附件资源库 ({blogStore.attachments.length})</span>
                </h3>
            </div>
        </div>

        {#if blogStore.attachments.length === 0}
            <div class="py-16 text-center text-neutral-400 text-xs">暂无媒体附件</div>
        {:else}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {#each blogStore.attachments as att}
                    <div class="p-3 rounded-2xl bg-black/2 dark:bg-white/4 border border-black/5 dark:border-white/8 flex flex-col justify-between gap-3 group hover:border-(--primary)/40 transition-all">
                        <div
                            class="w-full h-40 rounded-xl overflow-hidden bg-black/5 dark:bg-black/40 relative cursor-pointer group/img"
                            onclick={() => previewImage = att}
                            role="button"
                            tabindex="0"
                            onkeydown={(e) => { if (e.key === 'Enter') previewImage = att; }}
                        >
                            <img
                                src={att.url}
                                alt={att.name}
                                class="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                                loading="lazy"
                            />
                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                                查看原图
                            </div>
                            <div class="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[9px] text-white font-mono">
                                {att.type || 'IMAGE'}
                            </div>
                        </div>

                        <div class="min-w-0">
                            <div class="text-xs font-bold text-neutral-900 dark:text-white truncate" title={att.name}>
                                {att.name}
                            </div>
                            <div class="text-[10px] text-neutral-400 font-mono mt-0.5">
                                {(att.size / 1024).toFixed(1)} KB · {att.uploadTime ? att.uploadTime.split('T')[0] : '刚刚'}
                            </div>
                        </div>

                        <div class="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5 gap-2">
                            <button
                                type="button"
                                class="flex-1 py-1.5 px-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-(--primary)/20 text-neutral-700 dark:text-neutral-300 hover:text-(--primary) text-xs font-medium border border-black/5 dark:border-white/8 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                onclick={() => handleCopyMarkdown(att.name, att.url)}
                                title="复制 Markdown 插入语法"
                            >
                                <Icon icon="material-symbols:content-copy-outline" class="text-sm" />
                                <span>复制 MD</span>
                            </button>

                            {#if authStore.can("attachments:*")}
                                <button
                                    type="button"
                                    class="p-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-500 border border-black/5 dark:border-white/8 transition-colors cursor-pointer"
                                    onclick={() => handleDeleteAttachment(att.id)}
                                    title="删除此资源"
                                >
                                    <Icon icon="material-symbols:delete-outline" class="text-sm" />
                                </button>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- 大图全屏预览弹窗 -->
    {#if previewImage}
        <div
            class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onclick={() => previewImage = null}
            role="button"
            tabindex="0"
            onkeydown={(e) => { if (e.key === 'Escape') previewImage = null; }}
        >
            <div class="max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden border border-white/15 card-base liquid-glass p-2 shadow-2xl relative" onclick={(e) => e.stopPropagation()}>
                <img src={previewImage.url} alt={previewImage.name} class="max-h-[80vh] w-auto object-contain rounded-2xl mx-auto" />
                <div class="p-3 flex items-center justify-between text-xs text-neutral-800 dark:text-neutral-200">
                    <span class="font-bold truncate">{previewImage.name}</span>
                    <button
                        type="button"
                        class="px-3 py-1 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-neutral-900 dark:text-white cursor-pointer"
                        onclick={() => previewImage = null}
                    >
                        关闭预览
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
