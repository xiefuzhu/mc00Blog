<script lang="ts">
import { blogStore } from "../store.svelte";
import { downloadTextFile } from "../markdown";
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";
import type { FullBackupBundle } from "../types";

let siteName = $state(blogStore.settings.siteName);
let siteSubtitle = $state(blogStore.settings.siteSubtitle);
let announcement = $state(blogStore.settings.announcement);
let footerText = $state(blogStore.settings.footerText);
let allowComments = $state(blogStore.settings.allowComments);
let copyProtection = $state(blogStore.settings.copyProtection);

let saveNotice = $state(false);
let importMessage = $state<string | null>(null);

function handleSaveSettings() {
    blogStore.updateSettings({
        siteName: siteName.trim(),
        siteSubtitle: siteSubtitle.trim(),
        announcement: announcement.trim(),
        footerText: footerText.trim(),
        allowComments,
        copyProtection,
    });
    saveNotice = true;
    setTimeout(() => {
        saveNotice = false;
    }, 2500);
}

function handleExportFullBackup() {
    const bundle: FullBackupBundle = {
        version: "cpamc-twilight-2.0",
        exportedAt: new Date().toISOString(),
        site: siteName,
        settings: blogStore.settings,
        categories: blogStore.categories,
        tags: blogStore.tags,
        posts: blogStore.posts,
        attachments: blogStore.attachments,
        folders: blogStore.folders,
    };

    const jsonString = JSON.stringify(bundle, null, 2);
    downloadTextFile(`blog-backup-${Date.now()}.json`, jsonString);
    importMessage = "备份包已生成，包含文章文件夹树与全部内容";
    setTimeout(() => { importMessage = null; }, 3000);
}

function handleImportFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const raw = event.target?.result as string;
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.posts || parsed.categories || parsed.settings)) {
                const ok = blogStore.restoreFromBackup(parsed as FullBackupBundle);
                importMessage = ok
                    ? "数据包解析校验通过，已成功恢复导入"
                    : "数据包结构不符合规范";
            } else {
                importMessage = "数据包结构不符合规范";
            }
        } catch {
            importMessage = "文件格式解析失败，请确保为标准 JSON 备份包";
        }
        // 允许重复选择同一个文件
        (e.target as HTMLInputElement).value = "";
        setTimeout(() => { importMessage = null; }, 3000);
    };
    reader.readAsText(file);
}
</script>

<div class="max-w-4xl mx-auto space-y-6 text-xs select-none text-neutral-900 dark:text-neutral-100">
    <!-- 设置面板主体 -->
    <div class="card-base liquid-glass p-6 sm:p-8 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl space-y-6">
        <div class="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/5">
            <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-(--primary) before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2">
                <h3 class="text-sm font-bold text-neutral-900 dark:text-white">
                    全站全局与运行时配置
                </h3>
                <p class="text-[11px] text-neutral-400">修改后将实时同步生效于博客前台导航栏、大横幅、页面标题及页脚</p>
            </div>
            {#if saveNotice}
                <span class="text-xs text-emerald-600 dark:text-emerald-400 font-semibold font-mono flex items-center gap-1">
                    <Icon icon="material-symbols:check-circle" class="text-base" />
                    已成功全局生效
                </span>
            {/if}
        </div>

        <div class="space-y-4">
            <div>
                <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">站点主标题</label>
                <input
                    type="text"
                    class="console-field w-full"
                    bind:value={siteName}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">站点副标题 / Slogan</label>
                <input
                    type="text"
                    class="console-field w-full"
                    bind:value={siteSubtitle}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">全站公告标语</label>
                <textarea
                    class="console-field w-full h-20 resize-none leading-relaxed"
                    style="border-radius: 1rem;"
                    placeholder="输入全站顶部跑马灯或弹窗公告..."
                    bind:value={announcement}
                ></textarea>
            </div>

            <div>
                <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">页脚自定义版权说明</label>
                <input
                    type="text"
                    class="console-field w-full font-mono"
                    bind:value={footerText}
                />
            </div>

            <div class="pt-4 space-y-3.5 border-t border-black/5 dark:border-white/5">
                <label class="flex items-center justify-between cursor-pointer p-3 rounded-2xl bg-black/2 dark:bg-white/3 border border-black/5 dark:border-white/5 hover:border-(--primary)/30 transition-colors">
                    <div>
                        <span class="font-semibold text-neutral-800 dark:text-neutral-200 block">文章评论功能</span>
                        <span class="text-[10.5px] text-neutral-400 block mt-0.5">允许访客发表评论与回复</span>
                    </div>
                    <input type="checkbox" bind:checked={allowComments} class="accent-(--primary) w-4 h-4 cursor-pointer" />
                </label>

                <label class="flex items-center justify-between cursor-pointer p-3 rounded-2xl bg-black/2 dark:bg-white/3 border border-black/5 dark:border-white/5 hover:border-(--primary)/30 transition-colors">
                    <div>
                        <span class="font-semibold text-neutral-800 dark:text-neutral-200 block">防复制保护 (CopyProtection)</span>
                        <span class="text-[10.5px] text-neutral-400 block mt-0.5">限制复制、右键菜单与无感选择</span>
                    </div>
                    <input type="checkbox" bind:checked={copyProtection} class="accent-(--primary) w-4 h-4 cursor-pointer" />
                </label>
            </div>

            <div class="pt-4 flex justify-end">
                <Button
                    variant="primary"
                    size="md"
                    label="保存系统设置并全站生效"
                    title="保存并立即生效"
                    onclick={handleSaveSettings}
                />
            </div>
        </div>
    </div>

    <!-- 数据备份与恢复卡片 -->
    <div class="card-base liquid-glass p-6 sm:p-8 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl space-y-4">
        <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-blue-500 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2">
            <h4 class="text-sm font-bold text-neutral-900 dark:text-white">
                全站数据离线备份与迁移
            </h4>
        </div>
        <p class="text-neutral-500 dark:text-neutral-400 leading-relaxed text-xs">
            导出包含所有博客文章、分类、标签、附件索引及全站设置的安全 JSON 数据包，用于灾难恢复与本地持久化。
        </p>

        {#if importMessage}
            <div class="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-center">
                {importMessage}
            </div>
        {/if}

        <div class="flex items-center gap-3 pt-2 flex-wrap">
            <Button
                variant="secondary"
                size="md"
                icon="material-symbols:download"
                label="立即下载全量备份文件 (.json)"
                title="导出包含文件夹树的全站备份"
                onclick={handleExportFullBackup}
            />

            <label class="console-btn console-btn--secondary console-btn--md cursor-pointer">
                <Icon icon="material-symbols:upload" class="text-base" />
                <span>从备份文件恢复</span>
                <input type="file" accept=".json" class="hidden" onchange={handleImportFile} />
            </label>
        </div>
    </div>
</div>
