<script lang="ts">
import { onMount } from "svelte";
import { authStore } from "../auth.svelte";
import { blogStore } from "../store.svelte";
import { pingBackend } from "../api/client";
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
let showUserMenu = $state(false);
let toastMessage = $state<string | null>(null);

let backendStatus = $state<{ online: boolean; latency: number; message: string }>({
    online: false,
    latency: 0,
    message: "检测中...",
});

const tabTitleMap: Record<ConsoleTab, { group: string; title: string }> = {
    dashboard: { group: "运行", title: "仪表盘大盘" },
    editor: { group: "内容", title: "快速创作" },
    posts: { group: "内容", title: "文章管理" },
    categories: { group: "内容", title: "分类目录" },
    tags: { group: "内容", title: "文章标签" },
    attachments: { group: "内容", title: "媒体素材" },
    logs: { group: "观测", title: "审计日志" },
    settings: { group: "控制", title: "站点配置" },
    users: { group: "控制", title: "用户管理" },
    roles: { group: "控制", title: "角色权限" },
    uc: { group: "控制", title: "个人中心" },
    keeper: { group: "运维", title: "系统体检" },
    articles: { group: "内容", title: "文章管理" },
    profile: { group: "控制", title: "个人中心" },
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

    pingBackend().then(res => {
        backendStatus = res;
    });

    const handleGlassChanged = (e: CustomEvent<{ mode: "liquid" | "frosted" }>) => {
        if (e.detail?.mode) {
            glassMode = e.detail.mode;
        }
    };

    window.addEventListener("glass-mode-changed" as any, handleGlassChanged);

    const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest("#console-user-avatar-trigger") && !target.closest("#console-user-menu-popover")) {
            showUserMenu = false;
        }
    };
    window.addEventListener("click", handleOutsideClick);

    return () => {
        window.removeEventListener("glass-mode-changed" as any, handleGlassChanged);
        window.removeEventListener("click", handleOutsideClick);
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
        pingBackend().then(res => { backendStatus = res; });
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

async function handleLogout() {
    if (confirm("确定要退出当前管理控制台账号吗？")) {
        await authStore.logout();
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
        <div class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border {backendStatus.online ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'}">
            <span class="w-1.5 h-1.5 rounded-full {backendStatus.online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
            <span>{backendStatus.online ? `在线 (${backendStatus.latency}ms)` : '本地沙箱'}</span>
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

<!-- 右下角常驻悬浮头像胶囊 -->
<div class="fixed bottom-5 right-5 sm:right-7 z-40 select-none">
    <div class="relative">
        <button
            id="console-user-avatar-trigger"
            type="button"
            class="console-btn console-btn--secondary console-btn--icon relative w-10 h-10 overflow-hidden ring-2 ring-(--primary)/30"
            onclick={() => showUserMenu = !showUserMenu}
            title="个人账号快捷菜单"
            aria-label="个人账号快捷菜单"
        >
            <img
                src={authStore.currentUser?.avatar || '/favicon.ico'}
                alt={authStore.currentUser?.name}
                class="w-full h-full object-cover rounded-full"
                onerror={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/favicon.ico';
                }}
            />
            <!-- 在线状态绿点 -->
            <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-(--primary) border-2 border-white dark:border-neutral-900"></span>
        </button>

        <!-- 悬浮弹窗卡片 -->
        {#if showUserMenu}
            <div
                id="console-user-menu-popover"
                class="absolute bottom-12 right-0 w-64 rounded-2xl p-4 shadow-2xl border border-black/10 dark:border-white/15 card-base liquid-glass text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150 z-50"
            >
                <!-- 用户概要 -->
                <div class="flex items-center gap-3 pb-3 border-b border-black/8 dark:border-white/10">
                    <img
                        src={authStore.currentUser?.avatar || '/favicon.ico'}
                        alt={authStore.currentUser?.name}
                        class="w-9 h-9 rounded-full object-cover border border-black/10 dark:border-white/10"
                    />
                    <div class="min-w-0 flex-1">
                        <div class="font-bold text-neutral-900 dark:text-white truncate">
                            {authStore.currentUser?.name}
                        </div>
                        <div class="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                            @{authStore.currentUser?.username} · {authStore.currentRole?.name || '管理员'}
                        </div>
                    </div>
                </div>

                <!-- 快捷功能跳转 -->
                <div class="space-y-1">
                    <button
                        type="button"
                        class="console-btn console-btn--ghost console-btn--sm block justify-start"
                        onclick={() => {
                            showUserMenu = false;
                            onSelectTab("uc");
                        }}
                    >
                        <Icon icon="material-symbols:account-circle-outline" class="text-base text-(--primary)" />
                        <span>个人中心与资料</span>
                    </button>
                    <button
                        type="button"
                        class="console-btn console-btn--ghost console-btn--sm block justify-start"
                        onclick={() => {
                            showUserMenu = false;
                            onSelectTab("settings");
                        }}
                    >
                        <Icon icon="material-symbols:tune" class="text-base text-blue-500" />
                        <span>站点系统设置</span>
                    </button>
                    <button
                        type="button"
                        class="console-btn console-btn--ghost console-btn--sm block justify-start"
                        onclick={() => {
                            showUserMenu = false;
                            onSelectTab("keeper");
                        }}
                    >
                        <Icon icon="material-symbols:health-and-safety-outline" class="text-base text-purple-500" />
                        <span>系统体检与备份</span>
                    </button>
                </div>

                <div class="pt-2 border-t border-black/8 dark:border-white/10 flex justify-between items-center">
                    <span class="text-[10px] text-neutral-400">状态: 活跃</span>
                    <button
                        type="button"
                        class="console-btn console-btn--danger console-btn--sm"
                        onclick={handleLogout}
                    >
                        退出登录
                    </button>
                </div>
            </div>
        {/if}
    </div>
</div>
