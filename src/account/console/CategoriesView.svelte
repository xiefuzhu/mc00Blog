<script lang="ts">
import { blogStore } from "../store.svelte";
import { authStore } from "../auth.svelte";
import Icon from "@components/common/icon.svelte";

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

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 select-none">
    <!-- 左侧：新建分类表单 -->
    {#if authStore.can("categories:*")}
        <div class="console-glass liquid-glass p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl space-y-4 text-xs bg-[#0f121a]/90 backdrop-blur-2xl">
            <h3 class="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
                <Icon icon="material-symbols:add-circle-outline" class="text-lg text-emerald-400" />
                <span>新建文章分类</span>
            </h3>

            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">分类名称 *</label>
                <input
                    type="text"
                    placeholder="例如: 技术架构"
                    class="console-glass-input w-full px-3.5 py-2 text-xs bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                    bind:value={newCatName}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">访问别名 (Slug)</label>
                <input
                    type="text"
                    placeholder="例如: architecture"
                    class="console-glass-input w-full px-3.5 py-2 text-xs font-mono bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                    bind:value={newCatSlug}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">分类描述</label>
                <textarea
                    placeholder="简述该分类收纳的内容方向..."
                    class="console-glass-input w-full px-3.5 py-2 text-xs h-20 resize-none leading-relaxed bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                    bind:value={newCatDesc}
                ></textarea>
            </div>

            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">主题色彩标记</label>
                <div class="flex items-center gap-3">
                    <input
                        type="color"
                        class="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0 p-0"
                        bind:value={newCatColor}
                    />
                    <span class="font-mono text-xs text-emerald-400 font-bold">{newCatColor}</span>
                </div>
            </div>

            <button
                type="button"
                class="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-md transition-all hover:scale-102 active:scale-98 cursor-pointer"
                onclick={handleCreate}
            >
                保存并创建分类
            </button>
        </div>
    {/if}

    <!-- 右侧：分类列表 -->
    <div class={`${authStore.can("categories:*") ? "lg:col-span-2" : "lg:col-span-3"} console-glass liquid-glass p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl space-y-4 bg-[#0f121a]/90 backdrop-blur-2xl`}>
        <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 class="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <span class="w-1.5 h-3.5 bg-emerald-500 rounded-full inline-block"></span>
                <span>全站分类目录 ({blogStore.categories.length})</span>
            </h3>
        </div>

        {#if blogStore.categories.length === 0}
            <div class="py-16 text-center text-neutral-400 text-xs">暂无分类数据</div>
        {:else}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {#each blogStore.categories as cat}
                    <div class="console-glass-card p-4 rounded-2xl border border-white/10 bg-[#12151f]/80 backdrop-blur-xl flex flex-col justify-between gap-3 group hover:border-emerald-500/30 transition-all">
                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span
                                        class="w-3 h-3 rounded-full shrink-0 shadow-xs"
                                        style="background-color: {cat.color || '#10b981'};"
                                    ></span>
                                    <h4 class="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                                        {cat.name}
                                    </h4>
                                </div>
                                <span class="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-white/5 text-neutral-400 border border-white/8">
                                    {cat.postCount || 0} 篇文章
                                </span>
                            </div>

                            <p class="text-xs text-neutral-400 line-clamp-2">
                                {cat.description || "暂无分类描述"}
                            </p>

                            <div class="text-[10.5px] font-mono text-neutral-500">
                                Slug: <span class="text-neutral-300">{cat.slug}</span>
                            </div>
                        </div>

                        {#if authStore.can("categories:*")}
                            <div class="flex items-center justify-end pt-2 border-t border-white/5">
                                <button
                                    type="button"
                                    class="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                                    onclick={() => handleDelete(cat.id)}
                                    title="删除此分类"
                                >
                                    <Icon icon="material-symbols:delete-outline" />
                                    <span>删除</span>
                                </button>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
