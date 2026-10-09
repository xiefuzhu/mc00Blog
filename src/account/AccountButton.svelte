<script lang="ts">
import { authStore } from "./auth.svelte";
import AccountMenu from "./AccountMenu.svelte";
import Icon from "@components/common/icon.svelte";

const roleDotClass = $derived.by(() => {
    if (!authStore.currentUser) return "bg-neutral-400 ring-neutral-300/40";
    switch (authStore.currentUser.role) {
        case "admin":
            return "bg-rose-500 ring-rose-400/40";
        case "editor":
            return "bg-indigo-500 ring-indigo-400/40";
        case "author":
            return "bg-purple-500 ring-purple-400/40";
        case "contributor":
            return "bg-amber-500 ring-amber-400/40";
        case "reader":
        default:
            return "bg-sky-500 ring-sky-400/40";
    }
});
</script>

<div class="relative z-50 h-full flex items-center">
    <button
        type="button"
        id="account-menu-button"
        aria-label="Halo 账户与管理系统"
        class="console-btn console-btn--ghost console-btn--icon rounded-full active:scale-95 relative"
        onclick={(e) => { e.stopPropagation(); authStore.toggleMenu(); }}
        title={authStore.currentUser ? `当前用户: ${authStore.currentUser.name} (${authStore.currentUser.role})` : "访客状态"}
    >
        <div class="w-7.5 h-7.5 rounded-full overflow-hidden border border-black/10 dark:border-white/20 bg-primary/10 flex items-center justify-center shadow-xs">
            {#if authStore.currentUser && (authStore.currentUser.customAvatarUrl || authStore.currentUser.avatar)}
                <img
                    src={authStore.currentUser.customAvatarUrl || authStore.currentUser.avatar}
                    alt={authStore.currentUser.name}
                    class="w-full h-full object-cover"
                />
            {:else}
                <Icon icon="material-symbols:account-circle" class="text-xl text-(--primary)" />
            {/if}
        </div>
        <!-- 角色标识点 -->
        <span
            class={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full ring-2 ${roleDotClass} transition-colors`}
        ></span>
    </button>

    <!-- 下拉菜单浮层 -->
    <AccountMenu />
</div>
