<script lang="ts">
/**
 * 控制台统一预览面板
 * - markdown / mdx: 走 preview.ts 的实时渲染管线 (katex + mermaid + 代码高亮)
 * - html: 在沙箱 iframe 中渲染, 可选「按站点样式」或「原始 HTML」
 */
import { untrack } from "svelte";

import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";
import {
    createPreview,
    buildSandboxDocument,
    ensurePreviewStyles,
    type PreviewController,
} from "../preview";
import { CONTENT_FORMAT_LABEL, normalizeContentFormat } from "../markdown";
import type { ContentFormat } from "../types";

interface Props {
    content: string;
    format?: ContentFormat;
    title?: string;
    /** 右上角附加操作 (例如「在新标签页打开」) */
    onOpenFull?: () => void;
}

let { content, format = "markdown", title = "实时排版预览", onOpenFull }: Props = $props();

let container = $state<HTMLElement | null>(null);
let controller: PreviewController | null = null;
let htmlMode = $state<"styled" | "raw">("styled");
let isDark = $state(false);

const currentFormat = $derived(normalizeContentFormat(format));
const isHtml = $derived(currentFormat === "html");
const isEmpty = $derived(!(content || "").trim());

const sandboxDocument = $derived(
    isHtml ? buildSandboxDocument(content, { dark: isDark, mode: htmlMode }) : "",
);

$effect(() => {
    if (typeof document === "undefined") return;
    isDark = document.documentElement.classList.contains("dark");
    const observer = new MutationObserver(() => {
        isDark = document.documentElement.classList.contains("dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
});

// 非 HTML: 建立一次预览控制器, 后续只更新内容
$effect(() => {
    const node = container;
    const html = isHtml;
    if (!node || html) return;
    ensurePreviewStyles();
    const initial = untrack(() => ({ content, format: normalizeContentFormat(format) }));
    controller = createPreview(node, initial);
    return () => {
        controller?.destroy();
        controller = null;
    };
});

// 内容/格式变化时增量更新
$effect(() => {
    const payload = { content, format: normalizeContentFormat(format) };
    if (controller) controller.update(payload);
});
</script>

<div class="card-base liquid-glass rounded-3xl p-5 border border-black/5 dark:border-white/8 shadow-xl flex flex-col">
    <div class="flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400 mb-2 px-1 pb-2 border-b border-black/5 dark:border-white/5">
        <span class="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
            <Icon icon="material-symbols:preview" class="text-(--primary)" />
            <span>{title}</span>
            <span class="console-count-badge h-5 min-w-6 px-2 text-[10px]">{CONTENT_FORMAT_LABEL[currentFormat]}</span>
        </span>

        <span class="flex items-center gap-2">
            {#if isHtml}
                <span class="flex items-center gap-1 rounded-full border border-black/8 dark:border-white/10 p-0.5">
                    <button
                        type="button"
                        class="console-chip px-2.5 py-1 {htmlMode === 'styled' ? 'is-active' : ''}"
                        onclick={() => (htmlMode = "styled")}
                    >
                        按站点样式
                    </button>
                    <button
                        type="button"
                        class="console-chip px-2.5 py-1 {htmlMode === 'raw' ? 'is-active' : ''}"
                        onclick={() => (htmlMode = "raw")}
                    >
                        原始 HTML
                    </button>
                </span>
            {:else}
                {#if currentFormat === "mdx"}
                    <span class="text-neutral-400 text-[11px] font-mono" title="MDX 在浏览器端按 Markdown 渲染, JSX 组件与 import 不会执行">MDX 近似预览</span>
                {/if}
                <span class="text-(--primary) font-mono text-[11px] font-bold">同步预览</span>
            {/if}

            {#if onOpenFull}
                <Button
                    variant="secondary"
                    size="sm"
                    icon="material-symbols:open-in-new"
                    label="新标签页"
                    title="在新标签页打开整页预览"
                    onclick={onOpenFull}
                />
            {/if}
        </span>
    </div>

    {#if isEmpty}
        <div class="w-full flex-1 min-h-[420px] flex items-center justify-center text-neutral-400 text-xs italic">
            在左侧输入源码后在此实时预览
        </div>
    {:else if isHtml}
        <iframe
            title="HTML 预览"
            class="w-full flex-1 min-h-[540px] rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-neutral-950"
            sandbox="allow-same-origin"
            srcdoc={sandboxDocument}
        ></iframe>
    {:else}
        <div
            bind:this={container}
            class="console-preview-body custom-md prose dark:prose-invert max-w-none w-full flex-1 min-h-[540px] overflow-y-auto p-4 text-xs sm:text-sm leading-relaxed text-neutral-900 dark:text-neutral-100 border border-black/5 dark:border-white/5 rounded-2xl bg-black/2 dark:bg-black/20"
        ></div>
    {/if}
</div>
