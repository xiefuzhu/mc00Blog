<script lang="ts">
import { authStore } from "./auth.svelte";
import Icon from "@components/common/icon.svelte";
import Button from "./console/Button.svelte";

function handleGoConsole() {
    authStore.closeModal();
    if (typeof window !== "undefined") {
        window.location.href = `/console/?tab=${authStore.activeModalTab || 'dashboard'}`;
    }
}
</script>

{#if authStore.isModalOpen}
    <div
        id="account-modal-backdrop"
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300"
    >
        <div
            id="account-modal-panel"
            class="liquid-glass max-w-md w-full rounded-2xl p-6 shadow-2xl border border-black/10 dark:border-white/10 text-center"
        >
            <div class="w-12 h-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3">
                <Icon icon="material-symbols:dashboard-outline" class="text-2xl" />
            </div>
            <h3 class="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-1">
                Halo 控制台已独立升级
            </h3>
            <p class="text-xs text-neutral-600 dark:text-neutral-400 mb-5 leading-relaxed">
                为了带来更纯粹专业的创作体验，博客管理系统已从前台弹窗升级为独立的沉浸式管理工作台。
            </p>
            <div class="flex gap-2">
                <Button
                    variant="secondary"
                    size="md"
                    block
                    label="关闭"
                    title="关闭提示"
                    onclick={() => authStore.closeModal()}
                />
                <Button
                    variant="primary"
                    size="md"
                    block
                    label="立即前往控制台"
                    title="打开控制台"
                    onclick={handleGoConsole}
                />
            </div>
        </div>
    </div>
{/if}
