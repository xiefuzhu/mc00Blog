<script lang="ts">
/**
 * 后台密码门禁
 *
 * 进入 /console/ 管理后台时必须输入管理密码, 由后端校验后签发会话令牌。
 * 只有密码错误与后端未连接两种明确的失败反馈。
 */
import { adminSession } from "../adminSession.svelte";
import { backendStatusStore } from "../backendStatus.svelte";
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";

let password = $state("");
let showPassword = $state(false);
let errorMessage = $state("");

async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    errorMessage = "";

    if (!password.trim()) {
        errorMessage = "请输入管理密码";
        return;
    }

    const res = await adminSession.login(password);
    if (!res.success) {
        errorMessage = res.message || "验证失败";
        password = "";
    } else {
        password = "";
    }
}
</script>

<div class="w-full max-w-md mx-auto p-7 sm:p-9 console-glass liquid-glass rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl relative text-xs select-none">
    <!-- 顶栏标识 -->
    <div class="text-center mb-6">
        <div class="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Icon icon="material-symbols:lock-outline" class="text-3xl" />
        </div>
        <h2 class="text-xl font-black text-neutral-900 dark:text-neutral-50 tracking-tight">
            管理后台
        </h2>
        <p class="text-neutral-500 dark:text-neutral-400 mt-1">
            请输入管理密码以进入内容管理工作台
        </p>
    </div>

    <!-- 错误反馈提示 -->
    {#if errorMessage}
        <div class="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
            <Icon icon="material-symbols:error-outline" class="text-base shrink-0" />
            <span>{errorMessage}</span>
        </div>
    {/if}

    <!-- 后端未连接提示 -->
    {#if backendStatusStore.checked && !backendStatusStore.online}
        <div class="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-2">
            <Icon icon="material-symbols:cloud-off-outline" class="text-base shrink-0" />
            <span>后端未连接 (php/start.bat)，暂时无法验证密码</span>
        </div>
    {/if}

    <form onsubmit={handleSubmit} class="space-y-4">
        <div>
            <label for="admin-password" class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                管理密码
            </label>
            <div class="relative">
                <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autocomplete="current-password"
                    placeholder="请输入后台管理密码"
                    class="console-field w-full pl-9 pr-10 font-mono"
                    bind:value={password}
                />
                <Icon icon="material-symbols:lock-outline" class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-base pointer-events-none" />
                <button
                    type="button"
                    class="console-btn console-btn--ghost console-btn--icon-sm absolute right-1.5 top-1/2 -translate-y-1/2"
                    onclick={() => (showPassword = !showPassword)}
                    title={showPassword ? "隐藏密码" : "显示密码"}
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                    <Icon icon={showPassword ? "material-symbols:visibility-off-outline" : "material-symbols:visibility-outline"} class="text-base" />
                </button>
            </div>
        </div>

        <Button
            variant="primary"
            size="md"
            block
            type="submit"
            icon={adminSession.checking ? "eos-icons:loading" : "material-symbols:login"}
            iconClass={adminSession.checking ? "text-base animate-spin" : "text-base"}
            label={adminSession.checking ? "正在验证..." : "进入管理后台"}
            title="验证密码"
            disabled={adminSession.checking}
        />
    </form>

    <!-- 底部引导 -->
    <div class="mt-6 pt-4 border-t border-black/5 dark:border-white/10 flex justify-end">
        <Button
            variant="ghost"
            size="sm"
            icon="material-symbols:arrow-back"
            label="返回博客主页"
            title="返回博客主页"
            href="/"
            target="_self"
        />
    </div>
</div>
