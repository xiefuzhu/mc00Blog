<script lang="ts">
import { blogStore } from "../store.svelte";
import { authStore } from "../auth.svelte";
import { downloadTextFile } from "../markdown";
import Icon from "@components/common/icon.svelte";
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
        authStore.currentUser?.name || "admin"
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

<div class="space-y-6 select-none">
    <!-- 顶部审计控制台 (CPAMC 经典模块化) -->
    <div class="console-glass liquid-glass p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl space-y-5 bg-[#0f121a]/90 backdrop-blur-2xl">
        <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <!-- 统计胶囊指示条 -->
            <div class="flex items-center gap-1.5 overflow-x-auto p-1 rounded-full bg-[#141720] border border-white/10 shrink-0">
                <button
                    type="button"
                    class="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer {selectedLevel === 'all' ? 'bg-white/15 text-white shadow-xs' : 'text-neutral-400 hover:text-white'}"
                    onclick={() => selectedLevel = 'all'}
                >
                    全部 ({statsCount.total})
                </button>
                <button
                    type="button"
                    class="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer {selectedLevel === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-400 hover:text-white'}"
                    onclick={() => selectedLevel = 'success'}
                >
                    成功 ({statsCount.success})
                </button>
                <button
                    type="button"
                    class="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer {selectedLevel === 'info' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-neutral-400 hover:text-white'}"
                    onclick={() => selectedLevel = 'info'}
                >
                    信息 ({statsCount.info})
                </button>
                <button
                    type="button"
                    class="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer {selectedLevel === 'warn' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-neutral-400 hover:text-white'}"
                    onclick={() => selectedLevel = 'warn'}
                >
                    警告 ({statsCount.warn})
                </button>
                <button
                    type="button"
                    class="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer {selectedLevel === 'error' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-neutral-400 hover:text-white'}"
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
                        class="console-glass-input pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 bg-[#141720] border border-white/10 rounded-xl w-full sm:w-56"
                        bind:value={searchKeyword}
                    />
                    <Icon icon="material-symbols:search" class="absolute left-2.5 top-2 text-neutral-400 text-sm pointer-events-none" />
                </div>

                <button
                    type="button"
                    class="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 transition-colors cursor-pointer"
                    onclick={handleRefresh}
                    title="刷新审计流"
                    aria-label="刷新审计流"
                >
                    <Icon icon="material-symbols:refresh" class="text-base {isRefreshing ? 'animate-spin text-emerald-400' : ''}" />
                </button>

                <button
                    type="button"
                    class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                    onclick={handleExportLogs}
                    title="导出全部日志为 JSON"
                >
                    <Icon icon="material-symbols:download" class="text-sm" />
                    <span>导出</span>
                </button>

                {#if authStore.can("logs:*")}
                    <button
                        type="button"
                        class="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                        onclick={handleClearLogs}
                        title="清空历史记录"
                    >
                        <Icon icon="material-symbols:delete-sweep-outline" class="text-sm" />
                        <span>清空</span>
                    </button>
                {/if}
            </div>
        </div>
    </div>

    <!-- 日志流列表 (终端风格深底等宽卡片) -->
    <div class="console-glass liquid-glass rounded-3xl p-5 sm:p-6 border border-white/10 shadow-xl space-y-4 bg-[#0f121a]/90 backdrop-blur-2xl">
        <div class="flex items-center justify-between pb-3 border-b border-white/10 text-xs text-neutral-400">
            <span class="font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                <span class="w-1.5 h-3.5 bg-emerald-500 rounded-full inline-block"></span>
                <span>事件审计流 ({filteredLogs.length})</span>
            </span>
            <span class="font-mono text-[11px]">按发生时间倒序排列</span>
        </div>

        {#if filteredLogs.length === 0}
            <div class="py-16 text-center text-neutral-400 text-xs">暂无审计日志记录</div>
        {:else}
            <div class="space-y-2.5">
                {#each filteredLogs as log}
                    <div class="p-3.5 rounded-2xl border border-white/8 bg-[#121520]/80 hover:bg-[#151926] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
                        <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                            <!-- 级别徽章 -->
                            <span class={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 border ${
                                log.level === 'success'
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : log.level === 'warn'
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                    : log.level === 'error'
                                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                    : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                            }`}>
                                {log.level}
                            </span>

                            <div class="min-w-0 flex-1">
                                <div class="font-bold text-white truncate text-[12.5px]">
                                    {log.action}
                                </div>
                                <div class="text-neutral-400 text-[11px] truncate mt-0.5">
                                    {log.detail || '无附加描述'}
                                </div>
                            </div>
                        </div>

                        <!-- 操作人、IP 与时间戳 -->
                        <div class="flex items-center gap-3 text-[10.5px] text-neutral-400 shrink-0 self-end sm:self-auto">
                            <span class="text-neutral-300 font-semibold">{log.operator}</span>
                            {#if log.ip}
                                <span class="text-neutral-500">[{log.ip}]</span>
                            {/if}
                            <span class="text-neutral-500">{formatTime(log.timestamp)}</span>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
