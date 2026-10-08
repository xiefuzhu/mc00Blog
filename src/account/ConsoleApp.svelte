<script lang="ts">
import { onMount, onDestroy } from "svelte";
import { authStore } from "./auth.svelte";
import { blogStore } from "./store.svelte";
import Sidebar from "./console/Sidebar.svelte";
import Header from "./console/Header.svelte";
import AccessDenied from "./console/AccessDenied.svelte";
import LoginCard from "./console/LoginCard.svelte";
import RegisterCard from "./console/RegisterCard.svelte";

import DashboardView from "./console/DashboardView.svelte";
import PostsView from "./console/PostsView.svelte";
import PostEditorView from "./console/PostEditorView.svelte";
import CategoriesView from "./console/CategoriesView.svelte";
import TagsView from "./console/TagsView.svelte";
import AttachmentsView from "./console/AttachmentsView.svelte";
import LogsView from "./console/LogsView.svelte";
import UsersView from "./console/UsersView.svelte";
import RolesView from "./console/RolesView.svelte";
import UserCenterView from "./console/UserCenterView.svelte";
import SettingsView from "./console/SettingsView.svelte";
import KeeperView from "./console/KeeperView.svelte";
import type { ConsoleTab } from "./types";

let currentTab = $state<ConsoleTab>("dashboard");
let authMode = $state<"login" | "register">("login");
let sidebarCollapsed = $state(false);
let mobileDrawerOpen = $state(false);

// 规范化 Tab
function normalizeTab(raw: string | null): ConsoleTab {
    if (!raw) return "dashboard";
    if (raw === "articles") return "posts";
    if (raw === "profile") return "uc";
    const validTabs: ConsoleTab[] = [
        "dashboard",
        "posts",
        "editor",
        "categories",
        "tags",
        "attachments",
        "logs",
        "users",
        "roles",
        "uc",
        "settings",
        "keeper",
    ];
    return validTabs.includes(raw as ConsoleTab) ? (raw as ConsoleTab) : "dashboard";
}

function syncUrlWithTab(tab: ConsoleTab) {
    if (typeof window !== "undefined" && window.history) {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", tab);
        window.history.replaceState({}, "", url.toString());
    }
}

function handleSelectTab(tab: ConsoleTab) {
    currentTab = tab;
    blogStore.setActiveTab(tab);
    syncUrlWithTab(tab);
    mobileDrawerOpen = false; // 移动端选择后自动关闭抽屉
}

function handleEditPost(postId: string) {
    blogStore.startEditing(postId);
    handleSelectTab("editor");
}

function handleEditorBack() {
    handleSelectTab("posts");
}

function handlePopState() {
    if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab");
        if (tabParam === "register") {
            authMode = "register";
        } else if (tabParam === "login") {
            authMode = "login";
        } else {
            const initial = normalizeTab(tabParam);
            currentTab = initial;
            blogStore.setActiveTab(initial);
        }
    }
}

onMount(() => {
    if (typeof window !== "undefined") {
        const savedCollapsed = localStorage.getItem("cpamc_sidebar_collapsed");
        if (savedCollapsed !== null) {
            sidebarCollapsed = savedCollapsed === "true";
        }

        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab");
        if (tabParam === "register") {
            authMode = "register";
        } else {
            authMode = "login";
            const initial = normalizeTab(tabParam);
            currentTab = initial;
            blogStore.setActiveTab(initial);
        }

        window.addEventListener("popstate", handlePopState);
    }
});

onDestroy(() => {
    if (typeof window !== "undefined") {
        window.removeEventListener("popstate", handlePopState);
    }
});

function toggleSidebarCollapse() {
    sidebarCollapsed = !sidebarCollapsed;
    if (typeof localStorage !== "undefined") {
        localStorage.setItem("cpamc_sidebar_collapsed", String(sidebarCollapsed));
    }
}
</script>

<div class="console-app-root w-full min-h-screen flex flex-col justify-start relative text-neutral-900 dark:text-neutral-100 font-sans">
    {#if !authStore.isLoggedIn}
        <!-- 未登录状态：展示全屏沉浸式极简毛玻璃登录与注册面板 -->
        <div class="w-full min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/25 dark:bg-black/60 backdrop-blur-2xl">
            {#if authMode === 'login'}
                <LoginCard
                    onLoginSuccess={() => handleSelectTab("dashboard")}
                    onSwitchToRegister={() => (authMode = "register")}
                />
            {:else}
                <RegisterCard
                    onRegisterSuccess={() => handleSelectTab("dashboard")}
                    onSwitchToLogin={() => (authMode = "login")}
                />
            {/if}
        </div>
    {:else if !authStore.canAccessConsole()}
        <!-- 已登录但无控制台权限（如 reader 普通读者）：展示拦截与引导 -->
        <div class="w-full min-h-screen flex items-center justify-center p-4 bg-black/25 dark:bg-black/60 backdrop-blur-2xl">
            <AccessDenied />
        </div>
    {:else}
        <!-- 已登录且具备权限：现代化悬浮玻璃工作台布局 -->
        <div class="w-full min-h-screen flex flex-row items-stretch relative overflow-x-hidden bg-neutral-100/40 dark:bg-black/30 text-neutral-900 dark:text-neutral-100">
            <!-- 移动端侧边栏抽屉遮罩 -->
            {#if mobileDrawerOpen}
                <div
                    class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden transition-opacity"
                    onclick={() => (mobileDrawerOpen = false)}
                    aria-hidden="true"
                ></div>
            {/if}

            <!-- 侧边导航栏 (桌面吸附 + 移动端可滑出抽屉) -->
            <Sidebar
                activeTab={currentTab}
                onSelectTab={handleSelectTab}
                collapsed={sidebarCollapsed}
                onToggleCollapse={toggleSidebarCollapse}
                mobileOpen={mobileDrawerOpen}
                onCloseMobile={() => (mobileDrawerOpen = false)}
            />

            <!-- 主内容工作区 (自适应填充剩余宽度) -->
            <div class="flex-1 min-w-0 w-full flex flex-col min-h-screen overflow-y-auto">
                <!-- 顶栏：面包屑导航与右上角 CPAMC 悬浮浮岛操作胶囊工具条 -->
                <Header
                    activeTab={currentTab}
                    onSelectTab={handleSelectTab}
                    onOpenMobileMenu={() => (mobileDrawerOpen = true)}
                />

                <!-- 核心工作区主容器 -->
                <main class="flex-1 w-full p-3.5 sm:p-6 lg:p-8 max-w-[1720px] mx-auto flex flex-col justify-start">
                    <div class="w-full transition-opacity duration-200">
                        {#if currentTab === 'dashboard'}
                            <DashboardView onSelectTab={handleSelectTab} />
                        {:else if currentTab === 'posts'}
                            <PostsView onEditPost={handleEditPost} />
                        {:else if currentTab === 'editor'}
                            <PostEditorView onBack={handleEditorBack} />
                        {:else if currentTab === 'categories'}
                            <CategoriesView />
                        {:else if currentTab === 'tags'}
                            <TagsView />
                        {:else if currentTab === 'attachments'}
                            <AttachmentsView />
                        {:else if currentTab === 'logs'}
                            <LogsView />
                        {:else if currentTab === 'users'}
                            <UsersView />
                        {:else if currentTab === 'roles'}
                            <RolesView />
                        {:else if currentTab === 'uc'}
                            <UserCenterView />
                        {:else if currentTab === 'settings'}
                            <SettingsView />
                        {:else if currentTab === 'keeper'}
                            <KeeperView />
                        {/if}
                    </div>
                </main>
            </div>
        </div>
    {/if}
</div>
