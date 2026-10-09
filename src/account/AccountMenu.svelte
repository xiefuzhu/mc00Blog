<script lang="ts">
import { onMount, onDestroy } from "svelte";
import { authStore } from "./auth.svelte";
import { blogStore } from "./store.svelte";
import { ROLE_INFO } from "./mockData";
import { onClickOutside } from "@utils/widget";
import Icon from "@components/common/icon.svelte";
import Button from "./console/Button.svelte";

function handleClickOutside(event: MouseEvent) {
    if (!authStore.isMenuOpen) return;
    onClickOutside(event, "account-menu-panel", "account-menu-button", () => {
        authStore.closeMenu();
    });
}

function handleNavigate(path: string) {
    authStore.closeMenu();
    if (typeof window !== "undefined") {
        window.location.href = path;
    }
}

async function handleLogout() {
    authStore.closeMenu();
    await authStore.logout();
}

onMount(() => {
    document.addEventListener("click", handleClickOutside);
});

onDestroy(() => {
    if (typeof document !== "undefined") {
        document.removeEventListener("click", handleClickOutside);
    }
});
</script>

<div
    id="account-menu-wrapper"
    class="absolute top-[calc(100%+8px)] right-0 w-80 max-w-[calc(100vw-1.5rem)] transition-all duration-200 origin-top-right z-50 {authStore.isMenuOpen ? 'scale-100 opacity-100 pointer-events-auto visible' : 'scale-95 opacity-0 pointer-events-none invisible'}"
>
    <div
        id="account-menu-panel"
        class="float-panel !top-0 liquid-glass p-4 w-full max-h-[calc(100vh-5rem)] overflow-y-auto overflow-x-hidden rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 text-xs"
    >
        {#if authStore.isLoggedIn && authStore.currentUser}
            <!-- 已登录：用户身份卡片 -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-black/4 dark:bg-white/5 border border-black/5 dark:border-white/10">
                <div class="relative w-12 h-12 shrink-0 rounded-full overflow-hidden bg-primary/10 border border-primary/20 shadow-xs">
                    <img
                        src={authStore.currentUser.customAvatarUrl || authStore.currentUser.avatar}
                        alt={authStore.currentUser.name}
                        class="w-full h-full object-cover"
                    />
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-sm text-neutral-800 dark:text-neutral-100 truncate">
                        {authStore.currentUser.name}
                    </div>
                    <div class="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono truncate">
                        @{authStore.currentUser.username}
                    </div>
                    <div class="mt-1">
                        {#if ROLE_INFO[authStore.currentUser.role]}
                            <span class={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full border ${ROLE_INFO[authStore.currentUser.role].badgeColor}`}>
                                {ROLE_INFO[authStore.currentUser.role].label}
                            </span>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- 控制台入口与快捷操作 -->
            <div class="mt-3 flex flex-col gap-1.5">
                {#if authStore.canAccessConsole()}
                    <Button
                        variant="primary"
                        size="md"
                        block
                        icon="material-symbols:dashboard-outline"
                        label="进入 Halo 管理控制台"
                        title="打开控制台"
                        onclick={() => handleNavigate('/console/')}
                    />

                    {#if authStore.can("posts:create")}
                        <Button
                            variant="secondary"
                            size="md"
                            block
                            icon="material-symbols:edit-document-outline"
                            label="撰写新文章 (Editor)"
                            title="打开快速创作"
                            onclick={() => handleNavigate('/console/?tab=editor')}
                        />
                    {/if}
                {:else}
                    <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                        <span class="font-semibold block mb-0.5">[普通读者身份]</span>
                        当前身份仅具备前台互动权限，未授权访问后台管理控制台。
                    </div>
                    <Button
                        variant="secondary"
                        size="md"
                        block
                        icon="material-symbols:account-circle-outline"
                        label="个人资料中心 (User Center)"
                        title="打开个人中心"
                        onclick={() => handleNavigate('/console/?tab=uc')}
                    />
                {/if}
            </div>

            <!-- 统计指标小条 -->
            <div class="grid grid-cols-3 gap-2 my-3 p-2 rounded-xl bg-black/3 dark:bg-white/4 text-center text-xs">
                <div>
                    <span class="text-neutral-400 text-[10px] block">已发布</span>
                    <span class="font-bold text-neutral-800 dark:text-neutral-100">{blogStore.stats.publishedCount}</span>
                </div>
                <div>
                    <span class="text-neutral-400 text-[10px] block">草稿箱</span>
                    <span class="font-bold text-neutral-800 dark:text-neutral-100">{blogStore.stats.draftCount}</span>
                </div>
                <div>
                    <span class="text-neutral-400 text-[10px] block">分类栏目</span>
                    <span class="font-bold text-neutral-800 dark:text-neutral-100">{blogStore.stats.totalCategories}</span>
                </div>
            </div>

            <div class="border-t border-black/5 dark:border-white/10 my-2"></div>

            <!-- 注销登录 -->
            <Button
                variant="danger"
                size="md"
                block
                icon="material-symbols:logout"
                label="退出登录"
                title="退出当前账号"
                onclick={handleLogout}
            />
        {:else}
            <!-- 未登录状态卡片 -->
            <div class="text-center py-4 px-2 space-y-3">
                <div class="w-12 h-12 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                    <Icon icon="material-symbols:account-circle-outline" class="text-2xl" />
                </div>
                <div>
                    <div class="font-bold text-sm text-neutral-800 dark:text-neutral-100">
                        访客未登录
                    </div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        登录后即可进入管理控制台或参与博客管理
                    </p>
                </div>

                <div class="pt-2 flex flex-col gap-2">
                    <Button
                        variant="primary"
                        size="md"
                        block
                        icon="material-symbols:login"
                        label="登录管理控制台"
                        title="登录控制台"
                        onclick={() => handleNavigate('/console/')}
                    />

                    <Button
                        variant="secondary"
                        size="md"
                        block
                        icon="material-symbols:person-add-outline"
                        label="注册读者账号"
                        title="注册读者账号"
                        onclick={() => handleNavigate('/console/?tab=register')}
                    />
                </div>
            </div>
        {/if}
    </div>
</div>
