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

<div class="space-y-6 select-none">
    <!-- 复制成功的发光提示 -->
    {#if copyFeedback}
        <div class="fixed top-8 right-8 z-50 px-4 py-2.5 rounded-2xl bg-neutral-900/95 text-white border border-emerald-500/40 shadow-2xl backdrop-blur-md text-xs font-mono flex items-center gap-2 animate-in fade-in zoom-in-95">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>已复制 Markdown 链接: {copyFeedback}</span>
        </div>
    {/if}

    <!-- 新增素材栏 -->
    {#if authStore.can("attachments:*")}
        <div class="console-glass liquid-glass p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl space-y-4 text-xs bg-[#0f121a]/90 backdrop-blur-2xl">
            <h3 class="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
                <Icon icon="material-symbols:add-photo-alternate-outline" class="text-lg text-emerald-400" />
                <span>录入媒体附件 / 图床资源</span>
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <input
                    type="text"
                    placeholder="文件名称 (例如: banner-wallpaper.webp)"
                    class="console-glass-input px-3.5 py-2 text-xs bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                    bind:value={newAttName}
                />
                <input
                    type="text"
                    placeholder="素材在线 URL 地址 (https://...)"
                    class="console-glass-input px-3.5 py-2 text-xs font-mono bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                    bind:value={newAttUrl}
                />
            </div>

            <div class="flex justify-end">
                <button
                    type="button"
                    class="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-md transition-all hover:scale-102 active:scale-98 cursor-pointer"
                    onclick={handleAddAttachment}
                >
                    确认录入附件库
                </button>
            </div>
        </div>
    {/if}

    <!-- 媒体资源网格 -->
    <div class="console-glass liquid-glass p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl space-y-5 bg-[#0f121a]/90 backdrop-blur-2xl">
        <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 class="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <span class="w-1.5 h-3.5 bg-emerald-500 rounded-full inline-block"></span>
                <span>附件资源库 ({blogStore.attachments.length})</span>
            </h3>
        </div>

        {#if blogStore.attachments.length === 0}
            <div class="py-16 text-center text-neutral-400 text-xs">暂无媒体附件</div>
        {:else}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {#each blogStore.attachments as att}
                    <div class="console-glass-card p-3 rounded-2xl border border-white/10 bg-[#12151f]/80 backdrop-blur-xl flex flex-col justify-between gap-3 group hover:border-emerald-500/30 transition-all">
                        <div
                            class="w-full h-40 rounded-xl overflow-hidden bg-black/40 relative cursor-pointer group/img"
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
                            <div class="text-xs font-bold text-white truncate" title={att.name}>
                                {att.name}
                            </div>
                            <div class="text-[10px] text-neutral-400 font-mono mt-0.5">
                                {(att.size / 1024).toFixed(1)} KB · {att.uploadedAt ? att.uploadedAt.split('T')[0] : '刚刚'}
                            </div>
                        </div>

                        <div class="flex items-center justify-between pt-2 border-t border-white/5 gap-2">
                            <button
                                type="button"
                                class="flex-1 py-1.5 px-2 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-neutral-300 hover:text-emerald-400 text-xs font-medium border border-white/8 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                onclick={() => handleCopyMarkdown(att.name, att.url)}
                                title="复制 Markdown 插入语法"
                            >
                                <Icon icon="material-symbols:content-copy-outline" class="text-sm" />
                                <span>复制 MD</span>
                            </button>

                            {#if authStore.can("attachments:*")}
                                <button
                                    type="button"
                                    class="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 border border-white/8 transition-colors cursor-pointer"
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
            <div class="max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden border border-white/15 bg-neutral-950 p-2 shadow-2xl relative" onclick={(e) => e.stopPropagation()}>
                <img src={previewImage.url} alt={previewImage.name} class="max-h-[80vh] w-auto object-contain rounded-2xl mx-auto" />
                <div class="p-3 flex items-center justify-between text-xs text-neutral-300">
                    <span class="font-bold truncate">{previewImage.name}</span>
                    <button
                        type="button"
                        class="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                        onclick={() => previewImage = null}
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
