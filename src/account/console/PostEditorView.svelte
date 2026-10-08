<script lang="ts">
import { blogStore } from "../store.svelte";
import { authStore } from "../auth.svelte";
import { renderMarkdown, insertFormatting, exportAstroMarkdown, downloadTextFile, countWords, getReadingTime } from "../markdown";
import Icon from "@components/common/icon.svelte";

let { onBack } = $props<{
    onBack: () => void;
}>();

// 编辑器内部可变状态
let title = $state(blogStore.currentEditingPost?.title || "");
let slug = $state(blogStore.currentEditingPost?.slug || `post-${Date.now()}`);
let content = $state(blogStore.currentEditingPost?.content || "");
let summary = $state(blogStore.currentEditingPost?.summary || "");
let cover = $state(blogStore.currentEditingPost?.cover || "");
let selectedCategories = $state<string[]>([...(blogStore.currentEditingPost?.categories || [])]);
let selectedTags = $state<string[]>([...(blogStore.currentEditingPost?.tags || [])]);
let customTagInput = $state("");
let customCategoryInput = $state("");
let pinned = $state(blogStore.currentEditingPost?.pinned || false);
let allowComment = $state(blogStore.currentEditingPost?.allowComment ?? true);
let visibility = $state<"public" | "private">(blogStore.currentEditingPost?.visibility || "public");

// 界面控制
let showDrawer = $state(false);
let editorMode = $state<"split" | "edit" | "preview">("split");
let textareaRef = $state<HTMLTextAreaElement | null>(null);
let toastMessage = $state<string | null>(null);

function showToast(msg: string) {
    toastMessage = msg;
    setTimeout(() => {
        toastMessage = null;
    }, 2500);
}

// 实时派生渲染与统计
let renderedHtml = $derived(renderMarkdown(content));
let currentWordCount = $derived(countWords(content));
let currentReadingTime = $derived(getReadingTime(content));

function handleFormat(prefix: string, suffix = "", placeholder = "示例文本") {
    if (!textareaRef) return;
    const updated = insertFormatting(textareaRef, prefix, suffix, placeholder);
    if (updated !== null) {
        content = updated;
    }
}

function handleSaveDraft() {
    savePost("draft");
    showToast("草稿已保存");
}

function handlePublish() {
    savePost("published");
    showToast("文章已发布上线");
}

function toggleCategory(catId: string) {
    if (selectedCategories.includes(catId)) {
        selectedCategories = selectedCategories.filter((id) => id !== catId);
    } else {
        selectedCategories = [...selectedCategories, catId];
    }
}

function addCustomCategory() {
    const val = customCategoryInput.trim();
    if (!val) return;
    const existing = blogStore.categories.find(c => c.name === val || c.slug === val);
    if (existing) {
        if (!selectedCategories.includes(existing.id)) {
            selectedCategories = [...selectedCategories, existing.id];
        }
    } else {
        const newCat = blogStore.createCategory({
            name: val,
            slug: `cat-${Date.now()}`,
            color: "#3b82f6",
        });
        selectedCategories = [...selectedCategories, newCat.id];
    }
    customCategoryInput = "";
}

function toggleTag(tagIdentifier: string) {
    if (selectedTags.includes(tagIdentifier)) {
        selectedTags = selectedTags.filter((t) => t !== tagIdentifier);
    } else {
        selectedTags = [...selectedTags, tagIdentifier];
    }
}

function addCustomTag() {
    const val = customTagInput.trim();
    if (!val) return;
    const existing = blogStore.tags.find(t => t.name === val || t.slug === val);
    const tagToAdd = existing ? existing.id : val;
    if (!selectedTags.includes(tagToAdd)) {
        selectedTags = [...selectedTags, tagToAdd];
    }
    customTagInput = "";
}

function removeTag(tagIdentifier: string) {
    selectedTags = selectedTags.filter((t) => t !== tagIdentifier);
}

function savePost(status: "published" | "draft") {
    const postPayload = {
        title: title.trim() || "未命名文章",
        slug: slug.trim() || `post-${Date.now()}`,
        content,
        summary: summary.trim() || content.slice(0, 100),
        cover: cover.trim(),
        categories: selectedCategories,
        tags: selectedTags,
        pinned,
        allowComment,
        visibility,
        status,
        wordCount: currentWordCount,
        readingTime: currentReadingTime,
    };

    if (blogStore.editingPostId) {
        blogStore.updatePost(blogStore.editingPostId, postPayload);
    } else {
        const authorId = authStore.currentUser?.id || "u-admin";
        const authorName = authStore.currentUser?.name || "Halo 管理员";
        const created = blogStore.createPost(postPayload, authorId, authorName);
        blogStore.editingPostId = created.id;
    }

    onBack();
}

function handleExportAstro() {
    const currentPost = blogStore.currentEditingPost || {
        id: "temp",
        title: title || "未命名文章",
        slug: slug || "untitled",
        content,
        summary,
        cover,
        status: "published" as const,
        visibility,
        pinned,
        allowComment,
        categories: selectedCategories,
        tags: selectedTags,
        authorId: authStore.currentUser?.id || "u-admin",
        authorName: authStore.currentUser?.name || "Halo 管理员",
        views: 0,
        wordCount: currentWordCount,
        readingTime: currentReadingTime,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const mdString = exportAstroMarkdown(currentPost, blogStore.categoriesMap, blogStore.tagsMap);
    downloadTextFile(`${slug || "article"}.md`, mdString);
    showToast(`已导出 ${slug || "article"}.md`);
}
</script>

{#if toastMessage}
    <div class="fixed top-6 right-8 z-50 px-4 py-2 rounded-2xl bg-white/95 dark:bg-neutral-900/95 text-neutral-900 dark:text-white border border-(--primary)/40 shadow-2xl backdrop-blur-xl text-xs font-mono flex items-center gap-2 animate-in fade-in zoom-in-95 pointer-events-none">
        <span class="w-2 h-2 rounded-full bg-(--primary) animate-pulse"></span>
        <span>{toastMessage}</span>
    </div>
{/if}

<div class="space-y-4 select-none text-neutral-900 dark:text-neutral-100">
    <!-- 顶栏操作区 -->
    <div class="card-base liquid-glass p-3.5 sm:p-4 rounded-3xl border border-black/5 dark:border-white/8 flex items-center justify-between gap-3 shadow-xl">
        <div class="flex items-center gap-3 flex-1 min-w-0">
            <button
                type="button"
                class="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white border border-black/5 dark:border-white/10 transition-colors shrink-0 cursor-pointer"
                onclick={onBack}
                title="返回文章列表"
                aria-label="返回文章列表"
            >
                <Icon icon="material-symbols:arrow-back" class="text-lg" />
            </button>
            <input
                type="text"
                placeholder="在此输入博文标题..."
                class="bg-transparent text-sm sm:text-base lg:text-lg font-bold text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none w-full"
                bind:value={title}
            />
        </div>

        <div class="flex items-center gap-2 shrink-0">
            <!-- 视图模式切换胶囊 (分屏 / 仅编辑 / 仅预览) -->
            <div class="hidden md:flex p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <button
                    type="button"
                    class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all {editorMode === 'edit' ? 'bg-white dark:bg-white/15 text-neutral-900 dark:text-white shadow-xs' : 'text-neutral-500 dark:text-neutral-400'}"
                    onclick={() => editorMode = "edit"}
                >
                    编辑
                </button>
                <button
                    type="button"
                    class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all {editorMode === 'split' ? 'bg-white dark:bg-white/15 text-neutral-900 dark:text-white shadow-xs' : 'text-neutral-500 dark:text-neutral-400'}"
                    onclick={() => editorMode = "split"}
                >
                    分屏
                </button>
                <button
                    type="button"
                    class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all {editorMode === 'preview' ? 'bg-white dark:bg-white/15 text-neutral-900 dark:text-white shadow-xs' : 'text-neutral-500 dark:text-neutral-400'}"
                    onclick={() => editorMode = "preview"}
                >
                    预览
                </button>
            </div>

            <button
                type="button"
                class="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 border border-black/5 dark:border-white/10 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                onclick={() => showDrawer = !showDrawer}
                title="文章属性与分类标签配置"
            >
                <Icon icon="material-symbols:tune" class="text-base text-(--primary)" />
                <span class="hidden sm:inline">属性配置</span>
                {#if selectedCategories.length > 0 || selectedTags.length > 0}
                    <span class="w-2 h-2 rounded-full bg-(--primary)"></span>
                {/if}
            </button>

            <button
                type="button"
                class="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/8 hover:bg-black/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 text-xs font-semibold border border-black/5 dark:border-white/10 transition-colors cursor-pointer"
                onclick={handleSaveDraft}
            >
                存草稿
            </button>

            <button
                type="button"
                class="px-4 py-1.5 rounded-xl bg-(--primary) hover:brightness-110 text-white text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                onclick={handlePublish}
            >
                发布博文
            </button>
        </div>
    </div>

    <!-- 快捷分类与标签直选条 (作者无需打开抽屉即可直观选择) -->
    <div class="card-base liquid-glass p-3 rounded-2xl border border-black/5 dark:border-white/8 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-neutral-400 text-[11px] font-semibold flex items-center gap-1">
                <Icon icon="material-symbols:folder-outline" class="text-sm text-orange-500" />
                分类:
            </span>
            <div class="flex flex-wrap items-center gap-1.5">
                {#each blogStore.categories as cat}
                    {@const isSelected = selectedCategories.includes(cat.id)}
                    <button
                        type="button"
                        class="px-2 py-0.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1 {isSelected ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/30' : 'bg-black/4 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-transparent'}"
                        onclick={() => toggleCategory(cat.id)}
                    >
                        {#if isSelected}
                            <Icon icon="material-symbols:check" class="text-xs" />
                        {/if}
                        <span>{cat.name}</span>
                    </button>
                {/each}
            </div>

            <div class="w-px h-3.5 bg-black/10 dark:bg-white/10 mx-1"></div>

            <span class="text-neutral-400 text-[11px] font-semibold flex items-center gap-1">
                <Icon icon="material-symbols:label-outline" class="text-sm text-(--primary)" />
                标签:
            </span>
            <div class="flex flex-wrap items-center gap-1.5">
                {#each blogStore.tags as tag}
                    {@const isSelected = selectedTags.includes(tag.id) || selectedTags.includes(tag.name)}
                    <button
                        type="button"
                        class="px-2 py-0.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1 {isSelected ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30' : 'bg-black/4 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-transparent'}"
                        onclick={() => toggleTag(tag.id)}
                    >
                        {#if isSelected}
                            <Icon icon="material-symbols:check" class="text-xs" />
                        {/if}
                        <span>#{tag.name}</span>
                    </button>
                {/each}
            </div>
        </div>

        <div class="flex items-center gap-3 text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
            <span>{currentWordCount} 字</span>
            <span>约 {currentReadingTime} 分钟阅读</span>
        </div>
    </div>

    <!-- Markdown 快捷格式化工具栏 -->
    <div class="card-base liquid-glass px-3 py-2 rounded-2xl border border-black/5 dark:border-white/8 flex items-center justify-between gap-2 overflow-x-auto text-xs shadow-sm">
        <div class="flex items-center gap-1 overflow-x-auto">
            <button type="button" class="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 font-bold cursor-pointer" onclick={() => handleFormat("## ", "", "二级标题")}>
                H2
            </button>
            <button type="button" class="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 font-bold cursor-pointer" onclick={() => handleFormat("### ", "", "三级标题")}>
                H3
            </button>
            <button type="button" class="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 font-bold cursor-pointer" onclick={() => handleFormat("**", "**", "粗体文字")}>
                B
            </button>
            <button type="button" class="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 italic cursor-pointer" onclick={() => handleFormat("*", "*", "斜体文字")}>
                I
            </button>
            <button type="button" class="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 cursor-pointer" onclick={() => handleFormat("> ", "", "引用文案")}>
                Quote
            </button>
            <button type="button" class="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-(--primary) font-mono cursor-pointer" onclick={() => handleFormat("```typescript\n", "\n```", "// 示例代码")}>
                Code
            </button>
            <button type="button" class="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 cursor-pointer" onclick={() => handleFormat("- ", "", "无序列表项")}>
                List
            </button>
            <button type="button" class="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 cursor-pointer" onclick={() => handleFormat("[链接描述](", ")", "https://")}>
                Link
            </button>
            <button type="button" class="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 cursor-pointer" onclick={() => handleFormat("![图片描述](", ")", "https://")}>
                Image
            </button>
            <button type="button" class="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-amber-500 cursor-pointer" onclick={() => handleFormat(":::tip\n", "\n:::", "提示内容")}>
                Tip
            </button>
            <div class="w-px h-3.5 bg-black/10 dark:bg-white/10 mx-1"></div>
            <button type="button" class="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer text-[11px]" onclick={handleExportAstro}>
                导出 .md
            </button>
        </div>
    </div>

    <!-- 编辑与排版对比区 -->
    <div class="grid {editorMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-4 min-h-[620px]">
        <!-- 源码编辑 -->
        {#if editorMode !== "preview"}
            <div class="card-base liquid-glass rounded-3xl p-5 border border-black/5 dark:border-white/8 shadow-xl flex flex-col">
                <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2 px-1 pb-2 border-b border-black/5 dark:border-white/5">
                    <span class="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                        <Icon icon="material-symbols:code" class="text-(--primary)" />
                        <span>Markdown 源码</span>
                    </span>
                    <span class="font-mono text-[11px] text-neutral-400">{content.length} 字符</span>
                </div>
                <textarea
                    bind:this={textareaRef}
                    class="w-full flex-1 min-h-[540px] bg-transparent text-xs sm:text-sm font-mono leading-relaxed text-neutral-900 dark:text-neutral-100 focus:outline-none resize-none p-2 border-none selection:bg-(--primary)/30"
                    placeholder="在此编写 Markdown 文章正文..."
                    bind:value={content}
                ></textarea>
            </div>
        {/if}

        <!-- 实时排版预览 -->
        {#if editorMode !== "edit"}
            <div class="card-base liquid-glass rounded-3xl p-5 border border-black/5 dark:border-white/8 shadow-xl flex flex-col">
                <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-2 px-1 pb-2 border-b border-black/5 dark:border-white/5">
                    <span class="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                        <Icon icon="material-symbols:preview" class="text-(--primary)" />
                        <span>实时排版预览</span>
                    </span>
                    <span class="text-(--primary) font-mono text-[11px] font-bold">同步预览</span>
                </div>
                <div class="w-full flex-1 min-h-[540px] overflow-y-auto p-4 text-xs sm:text-sm leading-relaxed text-neutral-900 dark:text-neutral-100 border border-black/5 dark:border-white/5 rounded-2xl bg-black/2 dark:bg-black/20 prose dark:prose-invert prose-emerald max-w-none">
                    {#if content.trim()}
                        {@html renderedHtml}
                    {:else}
                        <div class="h-full flex items-center justify-center text-neutral-400 text-xs italic">
                            在左侧输入 Markdown 源码后在此实时排版预览
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>

    <!-- 文章属性设置侧边抽屉 -->
    {#if showDrawer}
        <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
            <div class="w-full max-w-md h-full card-base liquid-glass p-6 overflow-y-auto shadow-2xl border-l border-black/10 dark:border-white/10 text-neutral-800 dark:text-neutral-200 flex flex-col justify-between">
                <div class="space-y-5">
                    <div class="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
                        <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-(--primary) before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2">
                            <h3 class="text-sm font-bold text-neutral-900 dark:text-white">
                                文章属性与高级配置
                            </h3>
                        </div>
                        <button
                            type="button"
                            class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                            onclick={() => showDrawer = false}
                        >
                            <Icon icon="material-symbols:close" class="text-base" />
                        </button>
                    </div>

                    <!-- 访问别名 (Slug) -->
                    <div>
                        <label class="block font-semibold text-neutral-700 dark:text-neutral-300 text-xs mb-1.5">访问别名 (Slug) *</label>
                        <input
                            type="text"
                            placeholder="my-awesome-post"
                            class="w-full px-3.5 py-2 text-xs font-mono card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:border-(--primary)/50"
                            bind:value={slug}
                        />
                        <p class="text-[10px] text-neutral-400 mt-1">用于文章 URL 路由后缀 (/posts/{slug})</p>
                    </div>

                    <!-- 封面图片 -->
                    <div>
                        <label class="block font-semibold text-neutral-700 dark:text-neutral-300 text-xs mb-1.5">封面图片 URL</label>
                        <input
                            type="text"
                            placeholder="https://... 或本地素材路径"
                            class="w-full px-3.5 py-2 text-xs font-mono card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:border-(--primary)/50"
                            bind:value={cover}
                        />
                        {#if cover.trim()}
                            <div class="mt-2 h-28 rounded-xl overflow-hidden border border-black/8 dark:border-white/10">
                                <img src={cover} alt="封面预览" class="w-full h-full object-cover" />
                            </div>
                        {/if}
                    </div>

                    <!-- 摘要简介 -->
                    <div>
                        <label class="block font-semibold text-neutral-700 dark:text-neutral-300 text-xs mb-1.5">自定义文章摘要</label>
                        <textarea
                            placeholder="若留空则自动截取文章前 100 字..."
                            class="w-full px-3.5 py-2 text-xs h-20 resize-none leading-relaxed card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:border-(--primary)/50"
                            bind:value={summary}
                        ></textarea>
                    </div>

                    <!-- 分类选择区 (可视化胶囊与新建输入) -->
                    <div>
                        <label class="block font-semibold text-neutral-700 dark:text-neutral-300 text-xs mb-1.5">所属分类</label>
                        <div class="flex flex-wrap gap-1.5 mb-2">
                            {#each blogStore.categories as cat}
                                {@const isSelected = selectedCategories.includes(cat.id)}
                                <button
                                    type="button"
                                    class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1 {isSelected ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 font-bold border-orange-500/40 shadow-xs' : 'bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 border-black/5 dark:border-white/10 hover:text-neutral-900 dark:hover:text-white'}"
                                    onclick={() => toggleCategory(cat.id)}
                                >
                                    {#if isSelected}
                                        <Icon icon="material-symbols:check" class="text-xs text-orange-500" />
                                    {/if}
                                    <span>{cat.name}</span>
                                </button>
                            {/each}
                        </div>
                        <div class="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="输入新分类名称..."
                                class="flex-1 px-3 py-1.5 text-xs card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:border-(--primary)/50"
                                bind:value={customCategoryInput}
                                onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomCategory(); } }}
                            />
                            <button
                                type="button"
                                class="px-3 py-1.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-xs font-bold hover:bg-orange-500/20 cursor-pointer"
                                onclick={addCustomCategory}
                            >
                                添加
                            </button>
                        </div>
                    </div>

                    <!-- 标签选择区 (预设多选胶囊 + 自定义追加) -->
                    <div>
                        <label class="block font-semibold text-neutral-700 dark:text-neutral-300 text-xs mb-1.5">文章标签</label>
                        <!-- 预设标签列表 -->
                        <div class="flex flex-wrap gap-1.5 mb-2.5">
                            {#each blogStore.tags as tag}
                                {@const isSelected = selectedTags.includes(tag.id) || selectedTags.includes(tag.name)}
                                <button
                                    type="button"
                                    class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1 {isSelected ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold border-emerald-500/40 shadow-xs' : 'bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 border-black/5 dark:border-white/10 hover:text-neutral-900 dark:hover:text-white'}"
                                    onclick={() => toggleTag(tag.id)}
                                >
                                    {#if isSelected}
                                        <Icon icon="material-symbols:check" class="text-xs text-emerald-500" />
                                    {/if}
                                    <span>#{tag.name}</span>
                                </button>
                            {/each}
                        </div>

                        <!-- 当前选中的自定义或所有标签可删除预览 -->
                        {#if selectedTags.length > 0}
                            <div class="p-2.5 rounded-xl bg-black/2 dark:bg-white/3 border border-black/5 dark:border-white/5 mb-2.5 flex flex-wrap gap-1.5 items-center">
                                <span class="text-[10px] text-neutral-400">已选中:</span>
                                {#each selectedTags as tagId}
                                    {@const tagName = blogStore.tagsMap.get(tagId) || tagId}
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono">
                                        <span>#{tagName}</span>
                                        <button
                                            type="button"
                                            class="hover:text-rose-500 cursor-pointer text-xs"
                                            onclick={() => removeTag(tagId)}
                                            title="移除标签"
                                        >
                                            ×
                                        </button>
                                    </span>
                                {/each}
                            </div>
                        {/if}

                        <div class="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="输入新标签并回车..."
                                class="flex-1 px-3 py-1.5 text-xs card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:border-(--primary)/50"
                                bind:value={customTagInput}
                                onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                            />
                            <button
                                type="button"
                                class="px-3 py-1.5 rounded-xl bg-(--primary)/10 text-(--primary) border border-(--primary)/20 text-xs font-bold hover:bg-(--primary)/20 cursor-pointer"
                                onclick={addCustomTag}
                            >
                                添加
                            </button>
                        </div>
                    </div>

                    <!-- 开关控制组 -->
                    <div class="space-y-2.5 pt-2 border-t border-black/5 dark:border-white/10">
                        <label class="flex items-center justify-between text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                            <span>置顶此文章</span>
                            <input type="checkbox" class="accent-(--primary) w-4 h-4 cursor-pointer" bind:checked={pinned} />
                        </label>
                        <label class="flex items-center justify-between text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                            <span>允许读者评论</span>
                            <input type="checkbox" class="accent-(--primary) w-4 h-4 cursor-pointer" bind:checked={allowComment} />
                        </label>
                        <div class="flex items-center justify-between text-xs text-neutral-700 dark:text-neutral-300">
                            <span>可见性范围</span>
                            <select class="card-base liquid-glass border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs text-neutral-800 dark:text-neutral-200" bind:value={visibility}>
                                <option value="public">公开可见</option>
                                <option value="private">仅自己可见</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="pt-6 border-t border-black/5 dark:border-white/10 flex items-center gap-3">
                    <button
                        type="button"
                        class="flex-1 py-2 rounded-xl bg-(--primary) hover:brightness-110 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
                        onclick={() => showDrawer = false}
                    >
                        完成设置
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
