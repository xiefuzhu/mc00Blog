<script lang="ts">
import { authStore } from "../auth.svelte";
import Icon from "@components/common/icon.svelte";

let { onLoginSuccess, onSwitchToRegister } = $props<{
    onLoginSuccess?: () => void;
    onSwitchToRegister?: () => void;
}>();

let username = $state("admin");
let password = $state("admin");
let showPassword = $state(false);
let isLoading = $state(false);
let isQuickLoading = $state(false);
let errorMessage = $state("");

// 一键免密快捷登入
async function handleQuickLogin() {
    errorMessage = "";
    isQuickLoading = true;
    try {
        const res = await authStore.quickLogin();
        if (res.success) {
            onLoginSuccess?.();
        } else {
            errorMessage = res.message || "快捷登入失败，请尝试普通登录";
        }
    } catch {
        errorMessage = "快捷登入异常，请重试";
    } finally {
        isQuickLoading = false;
    }
}

// 普通表单提交登录
async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    errorMessage = "";
    if (!username.trim() || !password.trim()) {
        errorMessage = "请输入用户名与密码";
        return;
    }

    isLoading = true;
    try {
        const res = await authStore.login(username, password);
        if (res.success) {
            onLoginSuccess?.();
        } else {
            errorMessage = res.message || "用户名或密码错误";
        }
    } catch {
        errorMessage = "登录请求失败，请稍后重试";
    } finally {
        isLoading = false;
    }
}
</script>

<div class="w-full max-w-md mx-auto p-7 sm:p-9 console-glass liquid-glass rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl relative text-xs select-none">
    <!-- 顶栏标识 -->
    <div class="text-center mb-6">
        <div class="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Icon icon="material-symbols:admin-panel-settings-outline" class="text-3xl" />
        </div>
        <h2 class="text-xl font-black text-neutral-900 dark:text-neutral-50 tracking-tight">
            Halo 管理控制台
        </h2>
        <p class="text-neutral-500 dark:text-neutral-400 mt-1">
            现代化内容创作管理中枢 · CPAMC 风格
        </p>
    </div>

    <!-- 错误反馈提示 -->
    {#if errorMessage}
        <div class="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
            <Icon icon="material-symbols:error-outline" class="text-base shrink-0" />
            <span>{errorMessage}</span>
        </div>
    {/if}

    <!-- 醒目推荐：一键免密进入工作台 -->
    <div class="mb-5">
        <button
            type="button"
            disabled={isQuickLoading || isLoading}
            class="console-glass-btn console-glass-btn-primary w-full py-3 px-4 text-xs font-bold shadow-lg flex items-center justify-center gap-2.5 cursor-pointer relative overflow-hidden group"
            onclick={handleQuickLogin}
        >
            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            {#if isQuickLoading}
                <Icon icon="eos-icons:loading" class="text-base animate-spin" />
                <span>正在一键直达工作台...</span>
            {:else}
                <Icon icon="material-symbols:bolt" class="text-lg text-amber-300" />
                <span class="tracking-wide">一键免密直接进入工作台 (推荐)</span>
            {/if}
        </button>
        <p class="text-center text-[11px] text-neutral-400 mt-1.5 font-mono">
            * 自动以系统超级管理员 (admin) 身份免密进入
        </p>
    </div>

    <div class="relative my-5 flex items-center justify-center">
        <div class="border-t border-black/10 dark:border-white/10 w-full"></div>
        <span class="bg-transparent px-3 text-[11px] text-neutral-400 uppercase tracking-widest absolute">或账号密码登录</span>
    </div>

    <!-- 账号密码表单 -->
    <form onsubmit={handleSubmit} class="space-y-4">
        <div>
            <label for="login-username" class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                用户名 / 电子邮箱
            </label>
            <div class="relative">
                <input
                    id="login-username"
                    type="text"
                    required
                    autocomplete="username"
                    placeholder="默认管理员: admin"
                    class="console-glass-input w-full pl-9 pr-3 py-2.5 font-mono text-xs"
                    bind:value={username}
                />
                <Icon icon="material-symbols:person-outline" class="absolute left-3 top-3 text-neutral-400 text-base pointer-events-none" />
            </div>
        </div>

        <div>
            <label for="login-password" class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                登录密码
            </label>
            <div class="relative">
                <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autocomplete="current-password"
                    placeholder="默认密码: admin"
                    class="console-glass-input w-full pl-9 pr-10 py-2.5 font-mono text-xs"
                    bind:value={password}
                />
                <Icon icon="material-symbols:lock-outline" class="absolute left-3 top-3 text-neutral-400 text-base pointer-events-none" />
                <button
                    type="button"
                    class="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                    onclick={() => (showPassword = !showPassword)}
                    title={showPassword ? "隐藏密码" : "显示密码"}
                >
                    <Icon icon={showPassword ? "material-symbols:visibility-off-outline" : "material-symbols:visibility-outline"} class="text-base" />
                </button>
            </div>
        </div>

        <button
            type="submit"
            disabled={isLoading || isQuickLoading}
            class="console-glass-btn w-full py-2.5 px-4 text-xs font-semibold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
        >
            {#if isLoading}
                <Icon icon="eos-icons:loading" class="text-base animate-spin" />
                <span>正在验证凭证...</span>
            {:else}
                <Icon icon="material-symbols:login" class="text-base" />
                <span>凭据登录控制台</span>
            {/if}
        </button>
    </form>

    <!-- 底部操作与引导 -->
    <div class="mt-6 pt-4 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-neutral-500 dark:text-neutral-400">
        <button
            type="button"
            class="hover:text-primary transition-colors text-xs font-semibold cursor-pointer"
            onclick={onSwitchToRegister}
        >
            注册新账号
        </button>

        <a
            href="/"
            data-no-swup
            class="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors flex items-center gap-1"
        >
            <Icon icon="material-symbols:arrow-back" class="text-xs" />
            <span>返回博客主页</span>
        </a>
    </div>

    <!-- 默认凭据指引 -->
    <div class="mt-4 p-2.5 rounded-2xl bg-black/3 dark:bg-white/3 border border-black/5 dark:border-white/5 text-[11px] text-neutral-400 text-center font-mono">
        初始预置账号：<strong class="text-neutral-700 dark:text-neutral-300">admin</strong> / 密码：<strong class="text-neutral-700 dark:text-neutral-300">admin</strong>
    </div>
</div>
