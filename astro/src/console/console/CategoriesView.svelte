<script lang="ts">
import { blogStore } from "../store.svelte";
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";

let newCatName = $state("");
let newCatSlug = $state("");
let newCatDesc = $state("");
let newCatColor = $state("#10b981");

function handleCreate() {
    if (!newCatName.trim()) return;
    blogStore.createCategory({
        name: newCatName.trim(),
        slug: newCatSlug.trim() || `cat-${Date.now()}`,
        description: newCatDesc.trim(),
        color: newCatColor,
    });
    newCatName = "";
    newCatSlug = "";
    newCatDesc = "";
}

function handleDelete(id: string) {
    if (confirm("确定要删除该分类吗？关联的文章不会被删除。")) {
        blogStore.deleteCategory(id);
    }
}
</script>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 select-none text-neutral-900 dark:text-neutral-100">
    <!-- 左侧：新建分类表单 -->
    <div class="card-base liquid-glass p-5 sm:p-6 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl space-y-4 text-xs">
            <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-orange-500 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 pb-2 border-b border-black/5 dark:border-white/5">
                <h3 class="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <span>新建文章分类</span>
                </h3>
            </div>

            <div>
                <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">分类名称 *</label>
                <input
                    type="text"
                    placeholder="例如: 技术架构"
                    class="console-field w-full"
                    bind:value={newCatName}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">访问别名 (Slug)</label>
                <input
                    type="text"
                    placeholder="例如: architecture"
                    class="console-field w-full font-mono"
                    bind:value={newCatSlug}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">分类描述</label>
                <textarea
                    placeholder="简述该分类收纳的内容方向..."
                    class="console-field w-full h-20 resize-none leading-relaxed"
                    style="border-radius: 1rem;"
                    bind:value={newCatDesc}
                ></textarea>
            </div>

            <div>
                <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">主题色彩标记</label>
                <div class="flex items-center gap-3">
                    <input
                        type="color"
                        class="w-10 h-10 rounded-2xl cursor-pointer bg-transparent border-0 p-0"
                        bind:value={newCatColor}
                    />
                    <span class="font-mono text-xs text-(--primary) font-bold">{newCatColor}</span>
                </div>
            </div>

            <Button
                variant="primary"
                size="md"
                block
                label="保存并创建分类"
                title="创建新分类"
                onclick={handleCreate}
            />
    </div>

    <!-- 右侧：分类列表 -->
    <div class="lg:col-span-2 card-base liquid-glass p-5 sm:p-6 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
            <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-(--primary) before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2">
                <h3 class="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>全站分类目录 ({blogStore.categories.length})</span>
                </h3>
            </div>
        </div>

        {#if blogStore.categories.length === 0}
            <div class="py-16 text-center text-neutral-400 text-xs">暂无分类数据</div>
        {:else}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {#each blogStore.categories as cat}
                    <div class="p-4 rounded-2xl bg-black/2 dark:bg-white/4 border border-black/5 dark:border-white/5 flex flex-col justify-between gap-3 group hover:border-(--primary)/40 transition-all">
                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span
                                        class="w-3 h-3 rounded-full shrink-0 shadow-xs"
                                        style="background-color: {cat.color || '#10b981'};"
                                    ></span>
                                    <h4 class="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-(--primary) transition-colors">
                                        {cat.name}
                                    </h4>
                                </div>
                                <span class="flex items-center gap-1.5 shrink-0">
                                    <span class="console-count-badge h-6 min-w-7 px-2 text-[11px]">{cat.postCount || 0}</span>
                                    <span class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">篇文章</span>
                                </span>
                            </div>

                            <p class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                                {cat.description || "暂无分类描述"}
                            </p>

                            <div class="text-[10.5px] font-mono text-neutral-400">
                                Slug: <span class="text-neutral-700 dark:text-neutral-300">{cat.slug}</span>
                            </div>
                        </div>

                        <div class="flex items-center justify-end pt-2 border-t border-black/5 dark:border-white/5">
                            <Button
                                variant="danger"
                                size="sm"
                                icon="material-symbols:delete-outline"
                                label="删除"
                                title="删除此分类"
                                onclick={() => handleDelete(cat.id)}
                            />
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
