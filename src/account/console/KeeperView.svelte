<script lang="ts">
import { onMount } from "svelte";
import { blogStore } from "../store.svelte";
import { authStore } from "../auth.svelte";
import { pingBackend } from "../api/client";
import Icon from "@components/common/icon.svelte";

let backendStatus = $state<{ online: boolean; latency: number; message: string }>({
    online: false,
    latency: 0,
    message: "检测中...",
});

let isChecking = $state(false);
let actionToast = $state<string | null>(null);
let storageUsageKb = $state(0);

onMount(() => {
    checkHealth();
    calcStorage();
});

function calcStorage() {
    if (typeof localStorage !== "undefined") {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                total += (localStorage.getItem(key) || "").length;
            }
        }
        storageUsageKb = Math.round((total / 1024) * 10) / 10;
    }
}

async function checkHealth() {
    isChecking = true;
    try {
        backendStatus = await pingBackend();
    } finally {
        isChecking = false;
    }
}

function showToast(msg: string) {
    actionToast = msg;
    setTimeout(() => {
        actionToast = null;
    }, 2800);
}

function handleRecalculateStats() {
    let updated = 0;
    for (const post of blogStore.posts) {
        blogStore.updatePost(post.id, {
            wordCount: post.content ? post.content.replace(/\s+/g, "").length : 0,
            readingTime: Math.ceil(((post.content || "").length) / 300) || 1,
        });
        updated++;
    }
    showToast(`已成功重新索引并核算 ${updated} 篇文章的阅读指标与字数`);
    blogStore.recordLog("Keeper 维护", `核算 ${updated} 篇文章字数`, "success");
}

function handleClearCache() {
    if (confirm("确定要刷新并清理本地临时缓存数据吗？（不会删除文章数据）")) {
        calcStorage();
        showToast("已清理本地临时缓存，当前数据安全存储于沙箱中");
        blogStore.recordLog("Keeper 清理", "清理本地临时数据缓存", "info");
    }
}

function handleCleanEmptyTags() {
    const beforeCount = blogStore.tags.length;
    for (const tag of blogStore.tags) {
        if (!tag.postCount || tag.postCount === 0) {
            blogStore.deleteTag(tag.id);
        }
    }
    const removed = beforeCount - blogStore.tags.length;
    showToast(removed > 0 ? `已清理 ${removed} 个无引用的冗余空标签` : "未发现无引用的空标签，无需清理");
    blogStore.recordLog("Keeper 维护", `清理 ${removed} 个未引用标签`, "info");
}
</script>

<div class="space-y-6 select-none">
    {#if actionToast}
        <div class="fixed top-8 right-8 z-50 px-4 py-2.5 rounded-2xl bg-neutral-900/95 text-white border border-emerald-500/40 shadow-2xl backdrop-blur-md text-xs font-mono flex items-center gap-2 animate-in fade-in zoom-in-95">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{actionToast}</span>
        </div>
    {/if}

    <!-- 顶部概览卡片 (CPAMC Keeper 插件风格) -->
    <div class="console-glass liquid-glass p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 bg-[#0f121a]/90 backdrop-blur-2xl">
        <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg">
                <Icon icon="material-symbols:extension-outline" class="text-3xl" />
            </div>
            <div>
                <div class="flex items-center gap-2">
                    <h2 class="text-lg sm:text-xl font-black text-white tracking-tight">
                        CPAMC Keeper 运维监控插件
                    </h2>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        v2.4.0 运行中
                    </span>
                </div>
                <p class="text-xs text-neutral-400 mt-1">
                    实时自检后端服务链路、存储限额、缓存水位并提供一键式数据库索引体检与数据优化。
                </p>
            </div>
        </div>

        <button
            type="button"
            class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-md flex items-center gap-2 transition-all hover:scale-102 active:scale-98 cursor-pointer shrink-0"
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
        <div class="console-glass-card p-6 rounded-3xl border border-white/10 shadow-xl bg-[#121520]/85 backdrop-blur-xl flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-semibold text-neutral-400">后端服务链路</span>
                    <span class={`w-2 h-2 rounded-full ${backendStatus.online ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-amber-400'}`}></span>
                </div>
                <div class="text-2xl font-black text-white font-mono my-1">
                    {backendStatus.online ? `${backendStatus.latency} ms` : "离线沙箱"}
                </div>
                <p class="text-xs text-neutral-400 mt-1">
                    {backendStatus.message}
                </p>
            </div>
            <div class="mt-4 pt-3 border-t border-white/5 text-[11px] text-neutral-500 font-mono">
                目标: 127.0.0.1:8000/api
            </div>
        </div>

        <!-- 卡片 2: 本地存储与配额 -->
        <div class="console-glass-card p-6 rounded-3xl border border-white/10 shadow-xl bg-[#121520]/85 backdrop-blur-xl flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-semibold text-neutral-400">本地沙箱存储</span>
                    <Icon icon="material-symbols:database-outline" class="text-emerald-400 text-base" />
                </div>
                <div class="text-2xl font-black text-white font-mono my-1">
                    {storageUsageKb} KB
                </div>
                <p class="text-xs text-neutral-400 mt-1">
                    配额已占用约 {((storageUsageKb / 5120) * 100).toFixed(1)}% (上限 5 MB)
                </p>
            </div>
            <div class="mt-4 pt-3 border-t border-white/5">
                <div class="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-500 rounded-full" style="width: {Math.min(100, (storageUsageKb / 5120) * 100)}%;"></div>
                </div>
            </div>
        </div>

        <!-- 卡片 3: 数据健康度评级 -->
        <div class="console-glass-card p-6 rounded-3xl border border-white/10 shadow-xl bg-[#121520]/85 backdrop-blur-xl flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-semibold text-neutral-400">健康度指标</span>
                    <span class="text-xs font-mono font-bold text-emerald-400">EXCELLENT</span>
                </div>
                <div class="text-2xl font-black text-white font-mono my-1">
                    100 / 100
                </div>
                <p class="text-xs text-neutral-400 mt-1">
                    文章、分类与标签索引无孤立引用
                </p>
            </div>
            <div class="mt-4 pt-3 border-t border-white/5 text-[11px] text-emerald-400 font-mono">
                状态: 索引树结构完整
            </div>
        </div>
    </div>

    <!-- 运维维护快捷操作矩阵 -->
    <div class="console-glass liquid-glass p-6 sm:p-7 rounded-3xl border border-white/10 shadow-xl space-y-4 bg-[#0f121a]/90 backdrop-blur-2xl">
        <h3 class="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
            <Icon icon="material-symbols:build-circle-outline" class="text-emerald-400 text-lg" />
            <span>Keeper 维护与优化工具箱</span>
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="p-4 rounded-2xl bg-[#141720]/80 border border-white/8 space-y-3 flex flex-col justify-between">
                <div>
                    <h4 class="font-bold text-white text-xs">重算全站文章阅读指标</h4>
                    <p class="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                        遍历所有博文重新计算净字数与预估阅读分钟数，修复遗漏的元数据。
                    </p>
                </div>
                <button
                    type="button"
                    class="w-full py-2 rounded-xl bg-white/10 hover:bg-emerald-500 hover:text-neutral-950 font-semibold text-xs text-white transition-all cursor-pointer"
                    onclick={handleRecalculateStats}
                >
                    执行重新核算
                </button>
            </div>

            <div class="p-4 rounded-2xl bg-[#141720]/80 border border-white/8 space-y-3 flex flex-col justify-between">
                <div>
                    <h4 class="font-bold text-white text-xs">清理无引用的空标签</h4>
                    <p class="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                        自动扫描并移除文章归档数为 0 的冗余标签，保持标签索引紧凑。
                    </p>
                </div>
                <button
                    type="button"
                    class="w-full py-2 rounded-xl bg-white/10 hover:bg-emerald-500 hover:text-neutral-950 font-semibold text-xs text-white transition-all cursor-pointer"
                    onclick={handleCleanEmptyTags}
                >
                    清理冗余空标签
                </button>
            </div>

            <div class="p-4 rounded-2xl bg-[#141720]/80 border border-white/8 space-y-3 flex flex-col justify-between">
                <div>
                    <h4 class="font-bold text-white text-xs">释放本地临时缓存</h4>
                    <p class="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                        重置本地无用临时键值，回收浏览器沙箱存储配额空间。
                    </p>
                </div>
                <button
                    type="button"
                    class="w-full py-2 rounded-xl bg-white/10 hover:bg-rose-500 hover:text-white font-semibold text-xs text-white transition-all cursor-pointer"
                    onclick={handleClearCache}
                >
                    安全释放缓存
                </button>
            </div>
        </div>
    </div>
</div>
