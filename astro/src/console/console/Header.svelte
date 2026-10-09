<script lang="ts">
import { onMount } from "svelte";
import { adminSession } from "../adminSession.svelte";
import { blogStore } from "../store.svelte";
import { backendStatusStore } from "../backendStatus.svelte";
import { setTheme } from "@utils/theme";
import Icon from "@components/common/icon.svelte";
import type { ConsoleTab } from "../types";

let { activeTab, onSelectTab, onOpenMobileMenu } = $props<{
    activeTab: ConsoleTab;
    onSelectTab: (tab: ConsoleTab) => void;
    onOpenMobileMenu?: () => void;
}>();

let isDark = $state(true);
let isRefreshing = $state(false);
let glassMode = $state<"liquid" | "frosted">("frosted");
let toastMessage = $state<string | null>(null);

const tabTitleMap: Record<ConsoleTab, { group: string; title: string }> = {
    dashboard: { group: "运行", title: "仪表盘大盘" },
    editor: { group: "内容", title: "快速创作" },
    posts: { group: "内容", title: "文章管理" },
    categories: { group: "内容", title: "分类目录" },
    tags: { group: "内容", title: "文章标签" },
    attachments: { group: "内容", title: "媒体素材" },
    logs: { group: "观测", title: "审计日志" },
    settings: { group: "控制", title: "站点配置" },
    keeper: { group: "运维", title: "系统体检" },
    articles: { group: "内容", title: "文章管理" },
};

function showToast(msg: string) {
    toastMessage = msg;
    setTimeout(() => {
        toastMessage = null;
    }, 2500);
}

onMount(() => {
    if (typeof document !== "undefined") {
        isDark = document.documentElement.classList.contains("dark");
        const currentMode =
            (document.documentElement.getAttribute("data-glass-mode") as "liquid" | "frosted") ||
            (localStorage.getItem("glass-mode") as "liquid" | "frosted") ||
            "frosted";
        glassMode = currentMode;
    }

    void backendStatusStore.refresh();

    const handleGlassChanged = (e: CustomEvent<{ mode: "liquid" | "frosted" }>) => {
        if (e.detail?.mode) {
            glassMode = e.detail.mode;
        }
    };

    window.addEventListener("glass-mode-changed" as any, handleGlassChanged);

    return () => {
        window.removeEventListener("glass-mode-changed" as any, handleGlassChanged);
    };
});

function toggleTheme() {
    if (typeof document === "undefined") return;
    const nextDark = !isDark;
    isDark = nextDark;
    setTheme(nextDark ? "dark" : "light");
    showToast(nextDark ? "已切换至深色模式" : "已切换至浅色模式");
}

function toggleGlassMode() {
    if (typeof document === "undefined") return;
    const nextMode = glassMode === "frosted" ? "liquid" : "frosted";
    glassMode = nextMode;
    if (typeof (window as any).setGlassMode === "function") {
        (window as any).setGlassMode(nextMode);
    } else {
        localStorage.setItem("glass-mode", nextMode);
        document.documentElement.setAttribute("data-glass-mode", nextMode);
        window.dispatchEvent(new CustomEvent("glass-mode-changed", { detail: { mode: nextMode } }));
    }
    showToast(nextMode === "liquid" ? "已开启液态玻璃渲染 (Liquid Glass)" : "已开启毛玻璃渲染 (Frosted Glass)");
}

function handleRefresh() {
    isRefreshing = true;
    blogStore.syncFromBackendApi().finally(() => {
        void backendStatusStore.refresh();
        setTimeout(() => {
            isRefreshing = false;
            showToast("数据与指标同步完毕");
        }, 500);
    });
}

function handleOpenBlog() {
    if (typeof window !== "undefined") {
        window.open("/", "_blank");
    }
}

function handleLogout() {
    if (confirm("确定要退出管理后台吗？")) {
        adminSession.logout();
    }
}
</script>

<!-- 全局轻量提示 Toast (顶部居中浮层) -->
{#if toastMessage}
    <div class="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl card-base liquid-glass text-neutral-900 dark:text-white border border-(--primary)/40 shadow-2xl backdrop-blur-xl text-xs font-mono flex items-center gap-2 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
        <span class="w-2 h-2 rounded-full bg-(--primary) animate-pulse"></span>
        <span>{toastMessage}</span>
    </div>
{/if}

<!-- 顶栏区域：左侧当前面包屑与状态 + 右上角悬浮药丸胶囊操作条 -->
<header class="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-2 flex items-center justify-between select-none">
    <!-- 左侧面包屑与移动端汉堡键 -->
    <div class="flex items-center gap-3">
        <!-- 移动端侧边栏汉堡按钮 -->
        <button
            type="button"
            class="console-btn console-btn--secondary console-btn--icon md:hidden"
            onclick={onOpenMobileMenu}
            title="打开导航抽屉"
            aria-label="打开导航抽屉"
        >
            <Icon icon="material-symbols:menu" class="text-lg text-(--primary)" />
        </button>

        <div class="flex items-center gap-2 text-xs font-mono">
            <span class="text-neutral-400 dark:text-neutral-500">{tabTitleMap[activeTab]?.group || '控制台'}</span>
            <span class="text-neutral-300 dark:text-neutral-600">/</span>
            <span class="font-bold text-neutral-800 dark:text-neutral-200">{tabTitleMap[activeTab]?.title || '视图'}</span>
        </div>

        <!-- 后端连通性徽章 -->
        <div class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border {backendStatusStore.online ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'}">
            <span class="w-1.5 h-1.5 rounded-full {backendStatusStore.online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}"></span>
            <span>{backendStatusStore.online ? `在线 (${backendStatusStore.latency}ms)` : '后端未连接'}</span>
        </div>
    </div>

    <!-- 右上角悬浮药丸工具条 -->
    <div class="flex items-center gap-2">
        <div class="card-base liquid-glass-bar h-9 px-2 sm:px-3 rounded-full flex items-center gap-1 sm:gap-1.5 border border-black/8 dark:border-white/10 shadow-xl text-neutral-700 dark:text-neutral-300">
            <!-- 1. 刷新按钮 -->
            <button
                type="button"
                class="console-btn console-btn--ghost console-btn--icon-sm"
                onclick={handleRefresh}
                title="刷新与同步数据"
                aria-label="刷新数据"
            >
                <Icon
                    icon="material-symbols:refresh"
                    class="text-base {isRefreshing ? 'animate-spin text-(--primary)' : ''}"
                />
            </button>

            <!-- 2. 访问博客前台 -->
            <button
                type="button"
                class="console-btn console-btn--ghost console-btn--icon-sm"
                onclick={handleOpenBlog}
                title="新标签页打开博客首页"
                aria-label="访问博客首页"
            >
                <Icon icon="material-symbols:language" class="text-base" />
            </button>

            <!-- 分割细竖线 -->
            <span class="w-px h-3.5 bg-black/10 dark:bg-white/10"></span>

            <!-- 3. 玻璃材质切换 (液态玻璃 / 毛玻璃) -->
            <button
                type="button"
                class="console-btn console-btn--ghost console-btn--icon-sm"
                onclick={toggleGlassMode}
                title={glassMode === 'liquid' ? "当前: 液态玻璃 (点击切换毛玻璃)" : "当前: 毛玻璃 (点击切换液态玻璃)"}
                aria-label="切换玻璃材质"
            >
                {#if glassMode === 'liquid'}
                    <Icon icon="material-symbols:water-drop" class="text-base text-cyan-500 dark:text-cyan-400" />
                {:else}
                    <Icon icon="material-symbols:blur-on" class="text-base text-(--primary)" />
                {/if}
            </button>

            <!-- 4. 主题模式切换 -->
            <button
                type="button"
                class="console-btn console-btn--ghost console-btn--icon-sm"
                onclick={toggleTheme}
                title={isDark ? "切换至浅色日间模式" : "切换至深色暗夜模式"}
                aria-label="切换主题模式"
            >
                {#if isDark}
                    <Icon icon="material-symbols:light-mode-outline" class="text-base" />
                {:else}
                    <Icon icon="material-symbols:dark-mode-outline" class="text-base" />
                {/if}
            </button>

            <!-- 分割细竖线 -->
            <span class="w-px h-3.5 bg-black/10 dark:bg-white/10"></span>

            <!-- 5. 退出控制台 -->
            <button
                type="button"
                class="console-btn console-btn--danger console-btn--icon-sm"
                onclick={handleLogout}
                title="退出控制台账号"
                aria-label="退出控制台"
            >
                <Icon icon="material-symbols:logout" class="text-base" />
            </button>
        </div>
    </div>
</header>

<!-- 后端未连接提示条 -->
{#if backendStatusStore.checked && !backendStatusStore.online}
    <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-lg backdrop-blur">
        后端未连接 (php/start.bat)，文章与内容数据暂不可用
    </div>
{/if}
