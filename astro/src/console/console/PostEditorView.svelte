<script lang="ts">
import { blogStore } from "../store.svelte";
import {
    insertFormatting,
    exportPostFile,
    downloadTextFile,
    countWords,
    getReadingTime,
    normalizeContentFormat,
    CONTENT_FORMAT_LABEL,
    CONTENT_FORMAT_EXTENSION,
    MANAGED_FRONTMATTER_KEYS,
} from "../markdown";
import { openConsolePreview } from "../preview";
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";
import PreviewPane from "./PreviewPane.svelte";
import type { ContentFormat } from "../types";

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
/**
 * 打开编辑器时的标签/分类快照。
 * 若用户没有改动它们, 写回时就不覆盖文件里的原值 —— 控制台的标签/分类词表
 * 与仓库文件里的写法可能不同 (例如「加密」vs「Encryption」), 不应因为保存被改写。
 */
const initialCategories = [...(blogStore.currentEditingPost?.categories || [])];
const initialTags = [...(blogStore.currentEditingPost?.tags || [])];
let customTagInput = $state("");
let customCategoryInput = $state("");
let pinned = $state(blogStore.currentEditingPost?.pinned || false);
let allowComment = $state(blogStore.currentEditingPost?.allowComment ?? true);
let visibility = $state<"public" | "private">(blogStore.currentEditingPost?.visibility || "public");
let contentFormat = $state<ContentFormat>(normalizeContentFormat(blogStore.currentEditingPost?.contentFormat));
let postFolderPath = $state<string>(blogStore.currentEditingPost?.folderPath ?? blogStore.composerFolderPath ?? "");

// 界面控制
let showDrawer = $state(false);
let editorMode = $state<"split" | "edit" | "preview">("split");
let textareaRef = $state<HTMLTextAreaElement | null>(null);
let toastMessage = $state<string | null>(null);
let loadingContent = $state(false);
let contentUnavailable = $state(false);
let writebackError = $state<string | null>(null);
/** 已经按需加载过正文的文章路径, 避免 effect 反复触发拉取 */
let loadedContentFor = $state<string | null>(null);

/** 去掉 Markdown/MDX/HTML 文章顶部的 frontmatter, 只保留正文 */
function stripFrontmatter(text: string): string {
    const match = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    return match ? text.slice(match[0].length) : text;
}

/** 由文章记录推导其在 articles/posts 下的相对路径 */
function postRelPath(post: { filePath?: string } | null | undefined): string | null {
    if (!post?.filePath) return null;
    const match = post.filePath.replace(/\\/g, "/").match(/content\/posts\/(.+)$/);
    return match ? match[1] : null;
}

/**
 * 真实文章在控制台里只保存元数据, 正文按需从仓库文件拉取。
 * 只要文章有真实文件 (filePath), 正文就以仓库文件为准, 不使用内存里的 content
 * (内存里的 content 可能只是 mock/摘要镜像, 一旦保存会覆盖真实文件)。
 */
$effect(() => {
    const post = blogStore.currentEditingPost;
    if (!post) return;
    const relPath = postRelPath(post);
    if (!relPath) return;
    if (loadedContentFor === relPath || loadingContent) return;

    loadedContentFor = relPath;
    loadingContent = true;
    void (async () => {
        const loaded = await blogStore.loadEntryContent("posts", relPath);
        if (loaded.ok && typeof loaded.content === "string") {
            content = stripFrontmatter(loaded.content);
            contentUnavailable = false;
        } else {
            contentUnavailable = true;
        }
        loadingContent = false;
    })();
});

const FORMAT_OPTIONS: { value: ContentFormat; label: string; icon: string }[] = [
    { value: "markdown", label: "Markdown", icon: "material-symbols:markdown" },
    { value: "mdx", label: "MDX", icon: "material-symbols:code-blocks" },
    { value: "html", label: "HTML", icon: "material-symbols:html" },
];

/** 正文输入框占位提示随格式变化, 避免在 HTML / MDX 模式下误导为 Markdown 语法 */
const contentPlaceholder = $derived(
    contentFormat === "html"
        ? "在此编写 HTML 文章正文 (可写片段或完整文档, 顶部可用 --- frontmatter ---)..."
        : contentFormat === "mdx"
          ? "在此编写 MDX 文章正文 (支持 Markdown 与 JSX 组件)..."
          : "在此编写 Markdown 文章正文...",
);

function showToast(msg: string) {
    toastMessage = msg;
    setTimeout(() => {
        toastMessage = null;
    }, 2500);
}

// 实时派生统计
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
        folderPath: postFolderPath,
        contentFormat,
    };

    const previousRelPath = postRelPath(blogStore.currentEditingPost);

    if (blogStore.editingPostId) {
        blogStore.updatePost(blogStore.editingPostId, postPayload);
    } else {
        const authorId = "u-admin";
        const authorName = "管理员";
        const created = blogStore.createPost(postPayload, authorId, authorName);
        blogStore.editingPostId = created.id;
    }

    void writeBackPost(status, previousRelPath);
    onBack();
}

/**
 * 本次写回需要覆盖的 frontmatter 字段。
 * 标签/分类只有被用户改动过才写回, 否则保留仓库文件里的原值。
 */
function managedFrontmatterKeys(): string[] {
    const same = (a: string[], b: string[]) =>
        a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
    return MANAGED_FRONTMATTER_KEYS.filter((key) => {
        if (key === "tags") return !same(selectedTags, initialTags);
        if (key === "category") return !same(selectedCategories, initialCategories);
        return true;
    });
}

/** 可写环境下把文章真实写回 articles/posts, 否则仅提示导出 */
async function writeBackPost(status: "published" | "draft", previousRelPath: string | null) {
    const post = blogStore.currentEditingPost;
    if (!post) return;

    if (!blogStore.contentWritable) {
        showToast("当前为只读模式, 已保存到控制台本地; 如需写回仓库请使用「导出」或本地开发环境");
        return;
    }

    const file = exportPostFile(
        { ...post, content, status, slug: post.slug, folderPath: postFolderPath } as any,
        contentFormat,
        blogStore.categoriesMap,
        blogStore.tagsMap,
    );

    const result = await blogStore.saveEntry("posts", file.path, {
        content: file.content,
        // 声明编辑器真正改动的 frontmatter 字段: 服务端据此保留其余字段
        // (copyProtection / encrypted / password / coverInContent 等) 与原值。
        frontmatterKeys: managedFrontmatterKeys(),
    });
    if (!result.ok) {
        writebackError = result.error || "写回失败";
        showToast(`写回失败: ${writebackError}`);
        return;
    }

    // 路径发生变化时移除旧文件, 避免仓库里留下重复文章
    if (previousRelPath && previousRelPath !== file.path) {
        await blogStore.deleteEntry("posts", previousRelPath);
    }

    writebackError = null;
    showToast(`已写入 articles/posts/${file.path}`);
}

/** 当前编辑器内的稿件快照 (用于导出与整页预览) */
function currentPayload() {
    const base = blogStore.currentEditingPost;
    return {
        title: title.trim() || "未命名文章",
        slug: slug.trim() || "untitled",
        content,
        summary: summary.trim() || base?.summary || "",
        cover: cover.trim() || base?.cover || "",
        status: (base?.status || "draft") as "published" | "draft" | "recycle",
        visibility,
        pinned,
        allowComment,
        categories: selectedCategories,
        tags: selectedTags,
        authorId: "u-admin",
        authorName: "管理员",
        views: base?.views || 0,
        wordCount: currentWordCount,
        readingTime: currentReadingTime,
        createdAt: base?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        folderPath: postFolderPath,
        contentFormat,
    };
}

function handleExportAstro() {
    const file = exportPostFile(
        currentPayload() as any,
        contentFormat,
        blogStore.categoriesMap,
        blogStore.tagsMap,
    );
    downloadTextFile(file.filename, file.content);
    showToast(`已导出 ${file.filename} → 目标路径 articles/posts/${file.path}`);
}

/** 整页预览 (前台真实排版) */
function handleOpenFullPreview() {
    const payload = currentPayload();
    openConsolePreview({
        title: payload.title,
        slug: payload.slug,
        format: contentFormat,
        content: payload.content,
        summary: payload.summary,
        cover: payload.cover,
        status: payload.status,
        categories: payload.categories.map((id) => blogStore.categoriesMap.get(id) || id),
        tags: payload.tags.map((id) => blogStore.tagsMap.get(id) || id),
        author: payload.authorName,
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
        wordCount: payload.wordCount,
        readingTime: payload.readingTime,
        folderPath: payload.folderPath,
    });
    showToast("已在新标签页打开整页预览");
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
            <Button
                variant="secondary"
                size="icon"
                icon="material-symbols:arrow-back"
                title="返回文章列表"
                onclick={onBack}
            />
            <div class="min-w-0 flex-1">
                <input
                    type="text"
                    placeholder="在此输入博文标题..."
                    class="bg-transparent text-sm sm:text-base lg:text-lg font-bold text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none w-full"
                    bind:value={title}
                />
                <div class="flex items-center gap-2 text-[10.5px] font-mono text-neutral-400 truncate">
                    <Icon icon="material-symbols:folder-outline" class="text-xs" />
                    <span class="text-(--primary)">{postFolderPath || "文章根目录"}</span>
                    <span>/</span>
                    <span class="truncate">{slug || "untitled"}.{CONTENT_FORMAT_EXTENSION[contentFormat]}</span>
                </div>
            </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
            <!-- 正文格式选择 (markdown / mdx / html) -->
            <div class="hidden sm:flex p-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                {#each FORMAT_OPTIONS as option}
                    <button
                        type="button"
                        class="console-chip px-2.5 py-1 {contentFormat === option.value ? 'is-active' : ''}"
                        onclick={() => (contentFormat = option.value)}
                        title={`正文格式: ${option.label}`}
                    >
                        {option.label}
                    </button>
                {/each}
            </div>

            <!-- 视图模式切换胶囊 (分屏 / 仅编辑 / 仅预览) -->
            <div class="hidden md:flex p-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <button
                    type="button"
                    class="console-chip px-2.5 py-1 {editorMode === 'edit' ? 'is-active' : ''}"
                    onclick={() => editorMode = "edit"}
                >
                    编辑
                </button>
                <button
                    type="button"
                    class="console-chip px-2.5 py-1 {editorMode === 'split' ? 'is-active' : ''}"
                    onclick={() => editorMode = "split"}
                >
                    分屏
                </button>
                <button
                    type="button"
                    class="console-chip px-2.5 py-1 {editorMode === 'preview' ? 'is-active' : ''}"
                    onclick={() => editorMode = "preview"}
                >
                    预览
                </button>
            </div>

            <Button
                variant="secondary"
                size="sm"
                icon="material-symbols:tune"
                label="属性配置"
                title="文章属性、文件夹与分类标签配置"
                onclick={() => (showDrawer = !showDrawer)}
            />

            <Button
                variant="secondary"
                size="sm"
                label="存草稿"
                onclick={handleSaveDraft}
            />

            <Button
                variant="primary"
                size="sm"
                label="发布博文"
                onclick={handlePublish}
            />
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
                        class="console-chip px-2.5 py-1 {isSelected ? 'is-active' : ''}"
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
                        class="console-chip px-2.5 py-1 {isSelected ? 'is-active' : ''}"
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
            <span>文件夹: <span class="text-(--primary)">{postFolderPath || "根目录"}</span></span>
            <span>{currentWordCount} 字</span>
            <span>约 {currentReadingTime} 分钟阅读</span>
        </div>
    </div>

    <!-- 快捷格式化工具栏 (按钮与全站控制台同族: 药丸 + 首页悬停语言) -->
    <div class="card-base liquid-glass px-3 py-2 rounded-2xl border border-black/5 dark:border-white/8 flex items-center justify-between gap-2 overflow-x-auto text-xs shadow-sm">
        <div class="flex items-center gap-1 overflow-x-auto">
            <button type="button" class="console-btn console-btn--ghost console-btn--sm" onclick={() => handleFormat("## ", "", "二级标题")}>
                H2
            </button>
            <button type="button" class="console-btn console-btn--ghost console-btn--sm" onclick={() => handleFormat("### ", "", "三级标题")}>
                H3
            </button>
            <button type="button" class="console-btn console-btn--ghost console-btn--sm" onclick={() => handleFormat("**", "**", "粗体文字")}>
                B
            </button>
            <button type="button" class="console-btn console-btn--ghost console-btn--sm italic" onclick={() => handleFormat("*", "*", "斜体文字")}>
                I
            </button>
            <button type="button" class="console-btn console-btn--ghost console-btn--sm" onclick={() => handleFormat("> ", "", "引用文案")}>
                引用
            </button>
            <button type="button" class="console-btn console-btn--ghost console-btn--sm font-mono" onclick={() => handleFormat("```typescript\n", "\n```", "// 示例代码")}>
                代码
            </button>
            <button type="button" class="console-btn console-btn--ghost console-btn--sm" onclick={() => handleFormat("- ", "", "无序列表项")}>
                列表
            </button>
            <button type="button" class="console-btn console-btn--ghost console-btn--sm" onclick={() => handleFormat("[链接描述](", ")", "https://")}>
                链接
            </button>
            <button type="button" class="console-btn console-btn--ghost console-btn--sm" onclick={() => handleFormat("![图片描述](", ")", "https://")}>
                图片
            </button>
            <button type="button" class="console-btn console-btn--ghost console-btn--sm" onclick={() => handleFormat(":::tip\n", "\n:::", "提示内容")}>
                提示块
            </button>
            <div class="w-px h-3.5 bg-black/10 dark:bg-white/10 mx-1"></div>
            <button type="button" class="console-btn console-btn--ghost console-btn--sm" onclick={handleExportAstro}>
                导出 .{CONTENT_FORMAT_EXTENSION[contentFormat]}
            </button>
        </div>
    </div>

    {#if loadingContent}
        <div class="card-base liquid-glass rounded-2xl px-3 py-2 border border-black/5 dark:border-white/8 text-[11px] text-neutral-500 flex items-center gap-2">
            <Icon icon="material-symbols:sync" class="text-base text-(--primary) animate-spin" />
            <span>正在从 articles/posts 读取正文...</span>
        </div>
    {:else if contentUnavailable}
        <div class="card-base liquid-glass rounded-2xl px-3 py-2 border border-amber-500/25 bg-amber-500/8 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <Icon icon="material-symbols:info-outline" class="text-base" />
            <span>当前环境无法读取仓库正文, 正文区域为空; 请在本地开发环境编辑, 或使用「导出」获取稿件文件。</span>
        </div>
    {/if}

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
                    placeholder={contentPlaceholder}
                    bind:value={content}
                ></textarea>
            </div>
        {/if}

        <!-- 实时排版预览 (与站点前台同款渲染管线: markdown-it + katex + mermaid + 代码高亮) -->
        {#if editorMode !== "edit"}
            <PreviewPane
                content={content}
                format={contentFormat}
                onOpenFull={handleOpenFullPreview}
            />
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
                            class="console-btn console-btn--ghost console-btn--icon-sm"
                            onclick={() => showDrawer = false}
                            title="关闭属性配置"
                            aria-label="关闭属性配置"
                        >
                            <Icon icon="material-symbols:close" class="text-base" />
                        </button>
                    </div>

                    <!-- 所属文件夹 (与首页「目录」面板同源) -->
                    <div>
                        <label class="block font-semibold text-neutral-700 dark:text-neutral-300 text-xs mb-1.5">所属文件夹</label>
                        <select
                            class="console-field w-full"
                            bind:value={postFolderPath}
                        >
                            <option value="">文章根目录 (articles/posts)</option>
                            {#each blogStore.postsFolderOptions as option}
                                <option value={option.folder.path}>
                                    {"\u00A0".repeat(option.depth * 2)}{option.depth > 0 ? "└ " : ""}{option.folder.name}
                                </option>
                            {/each}
                        </select>
                        <p class="text-[10px] text-neutral-400 mt-1">
                            导出目标: articles/posts/{postFolderPath ? `${postFolderPath}/` : ""}{slug || "untitled"}.{CONTENT_FORMAT_EXTENSION[contentFormat]}
                        </p>
                    </div>

                    <!-- 访问别名 (Slug) -->
                    <div>
                        <label class="block font-semibold text-neutral-700 dark:text-neutral-300 text-xs mb-1.5">访问别名 (Slug) *</label>
                        <input
                            type="text"
                            placeholder="my-awesome-post"
                            class="console-field w-full font-mono"
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
                            class="console-field w-full font-mono"
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
                            class="console-field w-full h-20 resize-none leading-relaxed"
                            style="border-radius: 1rem;"
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
                                    class="console-chip {isSelected ? 'is-active' : ''}"
                                    onclick={() => toggleCategory(cat.id)}
                                >
                                    {#if isSelected}
                                        <Icon icon="material-symbols:check" class="text-xs" />
                                    {/if}
                                    <span>{cat.name}</span>
                                </button>
                            {/each}
                        </div>
                        <div class="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="输入新分类名称..."
                                class="console-field flex-1"
                                bind:value={customCategoryInput}
                                onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomCategory(); } }}
                            />
                            <Button
                                variant="secondary"
                                size="sm"
                                label="添加"
                                title="新建并选中该分类"
                                onclick={addCustomCategory}
                            />
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
                                    class="console-chip {isSelected ? 'is-active' : ''}"
                                    onclick={() => toggleTag(tag.id)}
                                >
                                    {#if isSelected}
                                        <Icon icon="material-symbols:check" class="text-xs" />
                                    {/if}
                                    <span>#{tag.name}</span>
                                </button>
                            {/each}
                        </div>

                        <!-- 当前选中的自定义或所有标签可删除预览 -->
                        {#if selectedTags.length > 0}
                            <div class="p-2.5 rounded-2xl bg-black/2 dark:bg-white/3 border border-black/5 dark:border-white/5 mb-2.5 flex flex-wrap gap-1.5 items-center">
                                <span class="text-[10px] text-neutral-400">已选中:</span>
                                {#each selectedTags as tagId}
                                    {@const tagName = blogStore.tagsMap.get(tagId) || tagId}
                                    <span class="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-(--primary)/12 text-(--primary) text-[11px] font-mono">
                                        <span>#{tagName}</span>
                                        <button
                                            type="button"
                                            class="console-btn console-btn--ghost console-btn--icon-sm !w-4 !h-4 !text-[11px]"
                                            onclick={() => removeTag(tagId)}
                                            title="移除标签"
                                            aria-label="移除标签"
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
                                class="console-field flex-1"
                                bind:value={customTagInput}
                                onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                            />
                            <Button
                                variant="secondary"
                                size="sm"
                                label="添加"
                                title="添加该标签"
                                onclick={addCustomTag}
                            />
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
                            <select class="console-field" bind:value={visibility}>
                                <option value="public">公开可见</option>
                                <option value="private">仅自己可见</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="pt-6 border-t border-black/5 dark:border-white/10">
                    <Button
                        variant="primary"
                        size="md"
                        block
                        label="完成设置"
                        title="保存属性配置并关闭抽屉"
                        onclick={() => showDrawer = false}
                    />
                </div>
            </div>
        </div>
    {/if}
</div>
