<script lang="ts">
import { blogStore } from "../store.svelte";
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";

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

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 select-none text-neutral-900 dark:text-neutral-100">
    <!-- 新建标签栏 -->
    <div class="card-base liquid-glass p-5 sm:p-6 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl space-y-4 text-xs">
            <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-emerald-500 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 pb-2 border-b border-black/5 dark:border-white/5">
                <h3 class="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <span>新建文章标签</span>
                </h3>
            </div>

            <div>
                <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">标签名称 *</label>
                <input
                    type="text"
                    placeholder="例如: Svelte 5"
                    class="console-field w-full"
                    bind:value={newTagName}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">访问别名 (Slug)</label>
                <input
                    type="text"
                    placeholder="例如: svelte-5"
                    class="console-field w-full font-mono"
                    bind:value={newTagSlug}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">色彩标记</label>
                <div class="flex items-center gap-3">
                    <input
                        type="color"
                        class="w-10 h-10 rounded-2xl cursor-pointer bg-transparent border-0 p-0"
                        bind:value={newTagColor}
                    />
                    <span class="font-mono text-xs text-(--primary) font-bold">{newTagColor}</span>
                </div>
            </div>

            <Button
                variant="primary"
                size="md"
                block
                label="保存并创建标签"
                title="创建新标签"
                onclick={handleCreateTag}
            />
    </div>

    <!-- 标签列表与标签云 -->
    <div class="lg:col-span-2 card-base liquid-glass p-5 sm:p-6 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl space-y-5">
        <div class="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
            <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-(--primary) before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2">
                <h3 class="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>标签索引库 ({blogStore.tags.length})</span>
                </h3>
            </div>
        </div>

        {#if blogStore.tags.length === 0}
            <div class="py-16 text-center text-neutral-400 text-xs">暂无文章标签数据</div>
        {:else}
            <!-- 标签云胶囊展示 -->
            <div class="flex flex-wrap gap-2.5">
                {#each blogStore.tags as tag}
                    <div class="inline-flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-full bg-black/2 dark:bg-white/4 border border-black/5 dark:border-white/8 hover:border-(--primary)/40 text-xs transition-all group">
                        <span
                            class="w-2 h-2 rounded-full shrink-0"
                            style="background-color: {tag.color || '#10b981'};"
                        ></span>
                        <span class="font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-(--primary)">{tag.name}</span>
                        <span class="console-count-badge h-6 min-w-7 px-2 text-[11px]">({tag.postCount || 0})</span>

                        <button
                            type="button"
                            class="console-btn console-btn--ghost console-btn--icon-sm hover:!text-rose-500"
                            onclick={() => handleDeleteTag(tag.id)}
                            title="删除此标签"
                            aria-label="删除标签"
                        >
                            <Icon icon="material-symbols:close" class="text-sm" />
                        </button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
