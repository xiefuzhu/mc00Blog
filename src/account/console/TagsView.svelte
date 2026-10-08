<script lang="ts">
import { blogStore } from "../store.svelte";
import { authStore } from "../auth.svelte";
import Icon from "@components/common/icon.svelte";

let newTagName = $state("");
let newTagSlug = $state("");
let newTagColor = $state("#10b981");

function handleCreateTag() {
    if (!newTagName.trim()) return;
    blogStore.createTag({
        name: newTagName.trim(),
        slug: newTagSlug.trim() || `tag-${Date.now()}`,
        color: newTagColor,
    });
    newTagName = "";
    newTagSlug = "";
}

function handleDeleteTag(id: string) {
    if (confirm("确定要删除该标签吗？")) {
        blogStore.deleteTag(id);
    }
}
</script>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 select-none">
    <!-- 新建标签栏 -->
    {#if authStore.can("tags:*")}
        <div class="console-glass liquid-glass p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl space-y-4 text-xs bg-[#0f121a]/90 backdrop-blur-2xl">
            <h3 class="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
                <Icon icon="material-symbols:new-label-outline" class="text-lg text-emerald-400" />
                <span>新建文章标签</span>
            </h3>

            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">标签名称 *</label>
                <input
                    type="text"
                    placeholder="例如: Svelte 5"
                    class="console-glass-input w-full px-3.5 py-2 text-xs bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                    bind:value={newTagName}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">访问别名 (Slug)</label>
                <input
                    type="text"
                    placeholder="例如: svelte-5"
                    class="console-glass-input w-full px-3.5 py-2 text-xs font-mono bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                    bind:value={newTagSlug}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">色彩标记</label>
                <div class="flex items-center gap-3">
                    <input
                        type="color"
                        class="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0 p-0"
                        bind:value={newTagColor}
                    />
                    <span class="font-mono text-xs text-emerald-400 font-bold">{newTagColor}</span>
                </div>
            </div>

            <button
                type="button"
                class="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-md transition-all hover:scale-102 active:scale-98 cursor-pointer"
                onclick={handleCreateTag}
            >
                保存并创建标签
            </button>
        </div>
    {/if}

    <!-- 标签列表与标签云 -->
    <div class={`${authStore.can("tags:*") ? "lg:col-span-2" : "lg:col-span-3"} console-glass liquid-glass p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl space-y-5 bg-[#0f121a]/90 backdrop-blur-2xl`}>
        <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 class="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <span class="w-1.5 h-3.5 bg-emerald-500 rounded-full inline-block"></span>
                <span>标签索引库 ({blogStore.tags.length})</span>
            </h3>
        </div>

        {#if blogStore.tags.length === 0}
            <div class="py-16 text-center text-neutral-400 text-xs">暂无文章标签数据</div>
        {:else}
            <!-- 标签云胶囊展示 -->
            <div class="flex flex-wrap gap-2.5">
                {#each blogStore.tags as tag}
                    <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141722]/80 border border-white/10 hover:border-emerald-500/40 text-xs transition-all group">
                        <span
                            class="w-2 h-2 rounded-full shrink-0"
                            style="background-color: {tag.color || '#10b981'};"
                        ></span>
                        <span class="font-medium text-neutral-200 group-hover:text-white">{tag.name}</span>
                        <span class="font-mono text-[10px] text-neutral-400">({tag.postCount || 0})</span>

                        {#if authStore.can("tags:*")}
                            <button
                                type="button"
                                class="text-neutral-500 hover:text-rose-400 ml-1 cursor-pointer transition-colors"
                                onclick={() => handleDeleteTag(tag.id)}
                                title="删除此标签"
                                aria-label="删除标签"
                            >
                                <Icon icon="material-symbols:close" class="text-sm" />
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
