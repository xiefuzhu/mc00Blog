<script lang="ts">
import { blogStore } from "../store.svelte";
import { downloadTextFile } from "../markdown";
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";
import type { AuditLog } from "../types";

let searchKeyword = $state("");
let selectedLevel = $state<"all" | "success" | "info" | "warn" | "error">("all");
let isRefreshing = $state(false);
let showAddModal = $state(false);

// 添加日志表单临时状态
let newAction = $state("");
let newDetail = $state("");
let newLevel = $state<"info" | "success" | "warn" | "error">("info");

const filteredLogs = $derived.by(() => {
    return blogStore.logs.filter((log) => {
        if (selectedLevel !== "all" && log.level !== selectedLevel) {
            return false;
        }
        if (searchKeyword.trim()) {
            const kw = searchKeyword.toLowerCase();
            const matchAction = log.action.toLowerCase().includes(kw);
            const matchDetail = (log.detail || "").toLowerCase().includes(kw);
            const matchOp = (log.operator || "").toLowerCase().includes(kw);
            const matchIp = (log.ip || "").toLowerCase().includes(kw);
            if (!matchAction && !matchDetail && !matchOp && !matchIp) return false;
        }
        return true;
    });
});

const statsCount = $derived.by(() => {
    const total = blogStore.logs.length;
    const success = blogStore.logs.filter((l) => l.level === "success").length;
    const info = blogStore.logs.filter((l) => l.level === "info").length;
    const warn = blogStore.logs.filter((l) => l.level === "warn").length;
    const error = blogStore.logs.filter((l) => l.level === "error").length;
    return { total, success, info, warn, error };
});

function handleRefresh() {
    isRefreshing = true;
    blogStore.syncFromBackendApi().finally(() => {
        setTimeout(() => {
            isRefreshing = false;
        }, 500);
    });
}

function handleClearLogs() {
    if (confirm("确定要清空全部控制台审计日志记录吗？")) {
        blogStore.clearLogs();
    }
}

function handleExportLogs() {
    const data = JSON.stringify(blogStore.logs, null, 2);
    downloadTextFile(`audit-logs-${Date.now()}.json`, data);
}

function handleRecordCustomLog() {
    if (!newAction.trim()) return;
    blogStore.recordLog(
        newAction.trim(),
        newDetail.trim() || "管理员手动录入的操作审计事件",
        newLevel,
        "admin"
    );
    newAction = "";
    newDetail = "";
    newLevel = "info";
    showAddModal = false;
}

function formatTime(iso: string) {
    if (!iso) return "--";
    try {
        const d = new Date(iso);
        return d.toLocaleString("zh-CN", { hour12: false });
    } catch {
        return iso;
    }
}
</script>

<div class="space-y-6 select-none text-neutral-900 dark:text-neutral-100">
    <!-- 顶部审计控制台 -->
    <div class="card-base liquid-glass p-5 sm:p-6 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl space-y-5">
        <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <!-- 统计胶囊指示条 -->
            <div class="flex items-center gap-1 overflow-x-auto p-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 shrink-0">
                <button
                    type="button"
                    class="console-chip {selectedLevel === 'all' ? 'is-active' : ''}"
                    onclick={() => selectedLevel = 'all'}
                >
                    全部 ({statsCount.total})
                </button>
                <button
                    type="button"
                    class="console-chip {selectedLevel === 'success' ? 'is-active' : ''}"
                    onclick={() => selectedLevel = 'success'}
                >
                    成功 ({statsCount.success})
                </button>
                <button
                    type="button"
                    class="console-chip {selectedLevel === 'info' ? 'is-active' : ''}"
                    onclick={() => selectedLevel = 'info'}
                >
                    信息 ({statsCount.info})
                </button>
                <button
                    type="button"
                    class="console-chip {selectedLevel === 'warn' ? 'is-active' : ''}"
                    onclick={() => selectedLevel = 'warn'}
                >
                    警告 ({statsCount.warn})
                </button>
                <button
                    type="button"
                    class="console-chip {selectedLevel === 'error' ? 'is-active' : ''}"
                    onclick={() => selectedLevel = 'error'}
                >
                    异常 ({statsCount.error})
                </button>
            </div>

            <!-- 搜索框与工具按钮 -->
            <div class="flex items-center gap-2.5 flex-wrap">
                <div class="relative flex-1 sm:flex-initial">
                    <input
                        type="text"
                        placeholder="检索动作 / 详情 / 操作人 / IP..."
                        class="console-field w-full sm:w-56 pl-8 pr-3"
                        bind:value={searchKeyword}
                    />
                    <Icon icon="material-symbols:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none" />
                </div>

                <Button
                    variant="secondary"
                    size="icon"
                    icon="material-symbols:refresh"
                    iconClass={isRefreshing ? "text-base animate-spin" : "text-base"}
                    title="刷新审计流"
                    disabled={isRefreshing}
                    onclick={handleRefresh}
                />

                <Button
                    variant="secondary"
                    size="sm"
                    icon="material-symbols:download"
                    label="导出"
                    title="导出全部日志为 JSON"
                    onclick={handleExportLogs}
                />

                <Button
                    variant="danger"
                    size="sm"
                    icon="material-symbols:delete-sweep-outline"
                    label="清空"
                    title="清空历史记录"
                    onclick={handleClearLogs}
                />
            </div>
        </div>
    </div>

    <!-- 日志流列表 -->
    <div class="card-base liquid-glass rounded-3xl p-5 sm:p-6 border border-black/5 dark:border-white/8 shadow-xl space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5 text-xs text-neutral-500 dark:text-neutral-400">
            <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-(--primary) before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2">
                <span class="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>事件审计流 ({filteredLogs.length})</span>
                </span>
            </div>
            <span class="font-mono text-[11px] text-neutral-400">按发生时间倒序排列</span>
        </div>

        {#if filteredLogs.length === 0}
            <div class="py-16 text-center text-neutral-400 text-xs">暂无审计日志记录</div>
        {:else}
            <div class="space-y-2.5">
                {#each filteredLogs as log}
                    <div class="p-3.5 rounded-2xl border border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/4 hover:bg-black/4 dark:hover:bg-white/8 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
                        <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                            <!-- 级别徽章 -->
                            <span class={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 border ${
                                log.level === 'success'
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                    : log.level === 'warn'
                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                    : log.level === 'error'
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                    : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                            }`}>
                                {log.level}
                            </span>

                            <div class="min-w-0 flex-1">
                                <div class="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                                    <span>{log.action}</span>
                                </div>
                                <div class="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                                    {log.detail}
                                </div>
                            </div>
                        </div>

                        <!-- 操作人、IP 与时间戳 -->
                        <div class="flex items-center gap-3 text-[10.5px] text-neutral-400 shrink-0 self-end sm:self-auto">
                            <span class="text-neutral-700 dark:text-neutral-300 font-semibold">{log.operator}</span>
                            {#if log.ip}
                                <span class="text-neutral-400">[{log.ip}]</span>
                            {/if}
                            <span class="text-neutral-400">{formatTime(log.timestamp)}</span>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
