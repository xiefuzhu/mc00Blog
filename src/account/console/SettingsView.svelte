<script lang="ts">
import { blogStore } from "../store.svelte";
import { authStore } from "../auth.svelte";
import { downloadTextFile } from "../markdown";
import Icon from "@components/common/icon.svelte";
import type { FullBackupBundle } from "../types";

let siteName = $state(blogStore.settings.siteName);
let siteSubtitle = $state(blogStore.settings.siteSubtitle);
let announcement = $state(blogStore.settings.announcement);
let footerText = $state(blogStore.settings.footerText);
let allowRegistration = $state(blogStore.settings.allowRegistration);
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
        allowRegistration,
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
        users: authStore.users.map(({ password, ...rest }) => rest),
    };

    const jsonString = JSON.stringify(bundle, null, 2);
    downloadTextFile(`blog-backup-${Date.now()}.json`, jsonString);
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
                if (parsed.settings) blogStore.updateSettings(parsed.settings);
                importMessage = "数据包解析校验通过，已成功恢复导入";
                setTimeout(() => { importMessage = null; }, 3000);
            } else {
                importMessage = "数据包结构不符合规范";
            }
        } catch {
            importMessage = "文件格式解析失败，请确保为标准 JSON 备份包";
        }
    };
    reader.readAsText(file);
}
</script>

<div class="max-w-4xl mx-auto space-y-6 text-xs select-none">
    <!-- 设置面板主体 -->
    <div class="console-glass liquid-glass p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6 bg-[#0f121a]/90 backdrop-blur-2xl">
        <div class="flex items-center justify-between pb-4 border-b border-white/10">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <Icon icon="material-symbols:tune" class="text-lg text-emerald-400" />
                <span>站点与控制台全局配置</span>
            </h3>
            {#if saveNotice}
                <span class="text-xs text-emerald-400 font-semibold font-mono">[配置已成功保存生效]</span>
            {/if}
        </div>

        <div class="space-y-4">
            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">站点主标题</label>
                <input
                    type="text"
                    class="console-glass-input w-full px-3.5 py-2.5 text-xs bg-[#141720] border border-white/10 rounded-xl text-white"
                    bind:value={siteName}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">站点副标题 / Slogan</label>
                <input
                    type="text"
                    class="console-glass-input w-full px-3.5 py-2.5 text-xs bg-[#141720] border border-white/10 rounded-xl text-white"
                    bind:value={siteSubtitle}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">全站公告标语</label>
                <textarea
                    class="console-glass-input w-full px-3.5 py-2.5 text-xs h-20 resize-none leading-relaxed bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                    placeholder="输入全站顶部跑马灯或弹窗公告..."
                    bind:value={announcement}
                ></textarea>
            </div>

            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">页脚自定义版权说明</label>
                <input
                    type="text"
                    class="console-glass-input w-full px-3.5 py-2.5 text-xs font-mono bg-[#141720] border border-white/10 rounded-xl text-white"
                    bind:value={footerText}
                />
            </div>

            <div class="pt-4 space-y-3.5 border-t border-white/10">
                <label class="flex items-center justify-between cursor-pointer p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                    <div>
                        <span class="font-semibold text-white block">开放外部注册</span>
                        <span class="text-[10.5px] text-neutral-400 block mt-0.5">允许普通读者注册新账号并参与互动</span>
                    </div>
                    <input type="checkbox" bind:checked={allowRegistration} class="accent-emerald-500 w-4 h-4 cursor-pointer" />
                </label>

                <label class="flex items-center justify-between cursor-pointer p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                    <div>
                        <span class="font-semibold text-white block">文章评论功能</span>
                        <span class="text-[10.5px] text-neutral-400 block mt-0.5">允许访客发表评论与回复</span>
                    </div>
                    <input type="checkbox" bind:checked={allowComments} class="accent-emerald-500 w-4 h-4 cursor-pointer" />
                </label>

                <label class="flex items-center justify-between cursor-pointer p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                    <div>
                        <span class="font-semibold text-white block">防复制保护 (CopyProtection)</span>
                        <span class="text-[10.5px] text-neutral-400 block mt-0.5">限制复制、右键菜单与无感选择</span>
                    </div>
                    <input type="checkbox" bind:checked={copyProtection} class="accent-emerald-500 w-4 h-4 cursor-pointer" />
                </label>
            </div>

            <div class="pt-4 flex justify-end">
                <button
                    type="button"
                    class="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-md transition-all hover:scale-102 active:scale-98 cursor-pointer"
                    onclick={handleSaveSettings}
                >
                    保存系统设置
                </button>
            </div>
        </div>
    </div>

    <!-- 数据备份与恢复卡片 -->
    <div class="console-glass liquid-glass p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl space-y-4 bg-[#0f121a]/90 backdrop-blur-2xl">
        <h4 class="text-sm font-bold text-white flex items-center gap-2">
            <Icon icon="material-symbols:archive-outline" class="text-lg text-emerald-400" />
            <span>全站数据完整离线备份与迁移</span>
        </h4>
        <p class="text-neutral-400 leading-relaxed text-xs">
            导出包含所有博客文章、分类、标签、附件索引、全站设置及用户凭据的安全 JSON 数据包，用于灾难恢复与本地持久化。
        </p>

        {#if importMessage}
            <div class="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-center">
                {importMessage}
            </div>
        {/if}

        <div class="flex items-center gap-3 pt-2 flex-wrap">
            <button
                type="button"
                class="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition-colors flex items-center gap-2 cursor-pointer"
                onclick={handleExportFullBackup}
            >
                <Icon icon="material-symbols:download" class="text-base text-emerald-400" />
                <span>立即下载全量备份文件 (.json)</span>
            </button>

            <label class="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white font-semibold text-xs border border-white/8 transition-colors flex items-center gap-2 cursor-pointer">
                <Icon icon="material-symbols:upload" class="text-base" />
                <span>从备份文件恢复</span>
                <input type="file" accept=".json" class="hidden" onchange={handleImportFile} />
            </label>
        </div>
    </div>
</div>
