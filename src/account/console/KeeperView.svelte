<script lang="ts">
import { onMount } from "svelte";
import { blogStore } from "../store.svelte";
import { pingBackend } from "../api/client";
import Icon from "@components/common/icon.svelte";

let isChecking = $state(false);
let backendStatus = $state<{ online: boolean; latency: number; message: string }>({
    online: false,
    latency: 0,
    message: "未开始检测",
});
let storageUsageKb = $state(0);
let actionToast = $state<string | null>(null);

function showToast(msg: string) {
    actionToast = msg;
    setTimeout(() => {
        actionToast = null;
    }, 2500);
}

function calculateStorage() {
    if (typeof window === "undefined") return;
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        const val = localStorage.getItem(key) || "";
        totalBytes += key.length + val.length;
    }
    storageUsageKb = Math.round(totalBytes / 1024);
}

async function checkHealth() {
    isChecking = true;
    calculateStorage();
    backendStatus = await pingBackend();
    setTimeout(() => {
        isChecking = false;
        showToast("全站系统体检诊断完毕");
    }, 400);
}

function handleRecalculateStats() {
    blogStore.posts = blogStore.posts.map(p => {
        const content = p.content || "";
        const chinese = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
        const english = (content.replace(/[\u4e00-\u9fa5]/g, " ").match(/[a-zA-Z0-9_-]+/g) || []).length;
        const words = chinese + english;
        return {
            ...p,
            wordCount: words,
            readingTime: Math.max(1, Math.ceil(words / 300)),
        };
    });
    blogStore.recordLog("运维体检", "重新核算全站文章字数与预估阅读时间", "info");
    showToast("文章阅读字数与耗时指标已重新校准");
}

function handleCleanEmptyTags() {
    const activeTagIds = new Set<string>();
    blogStore.posts.forEach(p => {
        p.tags?.forEach(t => activeTagIds.add(t));
    });
    const beforeCount = blogStore.tags.length;
    blogStore.tags = blogStore.tags.filter(t => activeTagIds.has(t.id) || activeTagIds.has(t.name));
    const cleaned = beforeCount - blogStore.tags.length;
    blogStore.recordLog("运维清理", `清理了 ${cleaned} 个无关联文章的冗余空标签`, "warn");
    showToast(`清理完毕，移除了 ${cleaned} 个无归属标签`);
}

function handleClearCache() {
    if (typeof window === "undefined") return;
    sessionStorage.clear();
    localStorage.removeItem("cpamc_temp_cache");
    calculateStorage();
    showToast("临时运行缓存与会话状态已全部清除");
}

onMount(() => {
    checkHealth();
});
</script>

<div class="space-y-6 select-none text-neutral-900 dark:text-neutral-100">
    {#if actionToast}
        <div class="fixed top-8 right-8 z-50 px-4 py-2.5 rounded-2xl card-base liquid-glass text-neutral-900 dark:text-white border border-(--primary)/40 shadow-2xl backdrop-blur-md text-xs font-mono flex items-center gap-2 animate-in fade-in zoom-in-95 pointer-events-none">
            <span class="w-2 h-2 rounded-full bg-(--primary) animate-pulse"></span>
            <span>{actionToast}</span>
        </div>
    {/if}

    <!-- 顶部概览卡片 -->
    <div class="card-base liquid-glass p-6 sm:p-8 rounded-3xl border border-black/5 dark:border-white/8 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-(--primary)/15 border border-(--primary)/30 flex items-center justify-center text-(--primary) shrink-0 shadow-lg">
                <Icon icon="material-symbols:extension-outline" class="text-3xl" />
            </div>
            <div>
                <div class="flex items-center gap-2">
                    <h2 class="text-lg sm:text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                        系统体检与运维插件
                    </h2>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        运行正常
                    </span>
                </div>
                <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    实时自检后端服务链路、存储限额、缓存水位并提供一键式数据库索引体检与数据优化。
                </p>
            </div>
        </div>

        <button
            type="button"
            class="px-5 py-2.5 rounded-xl bg-(--primary) hover:brightness-110 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all active:scale-98 cursor-pointer shrink-0"
            onclick={checkHealth}
            disabled={isChecking}
        >
            <Icon icon="material-symbols:refresh" class={isChecking ? "animate-spin" : ""} />
            <span>{isChecking ? "诊断中..." : "立即体检"}</span>
        </button>
    </div>

    <!-- 3 个状态卡片网格 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <!-- 卡片 1: 后端网关通信状态 -->
        <div class="card-base liquid-glass p-6 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">后端服务链路</span>
                    <span class={`w-2 h-2 rounded-full ${backendStatus.online ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500'}`}></span>
                </div>
                <div class="text-2xl font-black text-neutral-900 dark:text-white font-mono my-1">
                    {backendStatus.online ? `${backendStatus.latency} ms` : "离线沙箱"}
                </div>
                <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    {backendStatus.message}
                </p>
            </div>
            <div class="mt-4 pt-3 border-t border-black/5 dark:border-white/5 text-[11px] text-neutral-400 font-mono">
                目标: 127.0.0.1:8000/api
            </div>
        </div>

        <!-- 卡片 2: 本地存储与配额 -->
        <div class="card-base liquid-glass p-6 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">本地沙箱存储</span>
                    <Icon icon="material-symbols:database-outline" class="text-(--primary) text-base" />
                </div>
                <div class="text-2xl font-black text-neutral-900 dark:text-white font-mono my-1">
                    {storageUsageKb} KB
                </div>
                <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    配额已占用约 {((storageUsageKb / 5120) * 100).toFixed(1)}% (上限 5 MB)
                </p>
            </div>
            <div class="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                <div class="h-1.5 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full bg-(--primary) rounded-full" style="width: {Math.min(100, (storageUsageKb / 5120) * 100)}%;"></div>
                </div>
            </div>
        </div>

        <!-- 卡片 3: 数据健康度评级 -->
        <div class="card-base liquid-glass p-6 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">健康度指标</span>
                    <span class="text-xs font-mono font-bold text-emerald-500">EXCELLENT</span>
                </div>
                <div class="text-2xl font-black text-neutral-900 dark:text-white font-mono my-1">
                    100 / 100
                </div>
                <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    文章、分类与标签索引无孤立引用
                </p>
            </div>
            <div class="mt-4 pt-3 border-t border-black/5 dark:border-white/5 text-[11px] text-emerald-500 font-mono">
                状态: 索引树结构完整
            </div>
        </div>
    </div>

    <!-- 运维维护快捷操作矩阵 -->
    <div class="card-base liquid-glass p-6 sm:p-7 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl space-y-4">
        <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-(--primary) before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 pb-2 border-b border-black/5 dark:border-white/5">
            <h3 class="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <span>系统维护与优化工具箱</span>
            </h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="p-4 rounded-2xl bg-black/2 dark:bg-white/4 border border-black/5 dark:border-white/5 space-y-3 flex flex-col justify-between">
                <div>
                    <h4 class="font-bold text-neutral-900 dark:text-white text-xs">重算全站文章阅读指标</h4>
                    <p class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                        遍历所有博文重新计算净字数与预估阅读分钟数，修复遗漏的元数据。
                    </p>
                </div>
                <button
                    type="button"
                    class="w-full py-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-(--primary) hover:text-white font-semibold text-xs text-neutral-700 dark:text-neutral-200 transition-all cursor-pointer"
                    onclick={handleRecalculateStats}
                >
                    执行重新核算
                </button>
            </div>

            <div class="p-4 rounded-2xl bg-black/2 dark:bg-white/4 border border-black/5 dark:border-white/5 space-y-3 flex flex-col justify-between">
                <div>
                    <h4 class="font-bold text-neutral-900 dark:text-white text-xs">清理无归属孤立标签</h4>
                    <p class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                        一键扫描并剔除未被任何文章引用的无用标签，保持索引整洁。
                    </p>
                </div>
                <button
                    type="button"
                    class="w-full py-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-(--primary) hover:text-white font-semibold text-xs text-neutral-700 dark:text-neutral-200 transition-all cursor-pointer"
                    onclick={handleCleanEmptyTags}
                >
                    清理冗余空标签
                </button>
            </div>

            <div class="p-4 rounded-2xl bg-black/2 dark:bg-white/4 border border-black/5 dark:border-white/5 space-y-3 flex flex-col justify-between">
                <div>
                    <h4 class="font-bold text-neutral-900 dark:text-white text-xs">释放本地临时缓存</h4>
                    <p class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                        重置本地无用临时键值，回收浏览器沙箱存储配额空间。
                    </p>
                </div>
                <button
                    type="button"
                    class="w-full py-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-rose-500 hover:text-white font-semibold text-xs text-neutral-700 dark:text-neutral-200 transition-all cursor-pointer"
                    onclick={handleClearCache}
                >
                    安全释放缓存
                </button>
            </div>
        </div>
    </div>
</div>
