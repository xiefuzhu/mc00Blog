<script lang="ts">
import { authStore } from "../auth.svelte";
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";

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
        <Button
            variant="primary"
            size="lg"
            block
            icon={isQuickLoading ? "eos-icons:loading" : "material-symbols:bolt"}
            iconClass={isQuickLoading ? "text-base animate-spin" : "text-lg"}
            label={isQuickLoading ? "正在一键直达工作台..." : "一键免密直接进入工作台 (推荐)"}
            title="以系统超级管理员身份免密进入"
            disabled={isQuickLoading || isLoading}
            onclick={handleQuickLogin}
        />
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
                    class="console-field w-full pl-9 pr-3 font-mono"
                    bind:value={username}
                />
                <Icon icon="material-symbols:person-outline" class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-base pointer-events-none" />
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
            variant="secondary"
            size="md"
            block
            type="submit"
            icon={isLoading ? "eos-icons:loading" : "material-symbols:login"}
            iconClass={isLoading ? "text-base animate-spin" : "text-base"}
            label={isLoading ? "正在验证凭证..." : "凭据登录控制台"}
            title="登录控制台"
            disabled={isLoading || isQuickLoading}
        />
    </form>

    <!-- 底部操作与引导 -->
    <div class="mt-6 pt-4 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
        <Button
            variant="ghost"
            size="sm"
            label="注册新账号"
            title="切换到注册"
            onclick={onSwitchToRegister}
        />
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

    <!-- 默认凭据指引 -->
    <div class="mt-4 p-2.5 rounded-2xl bg-black/3 dark:bg-white/3 border border-black/5 dark:border-white/5 text-[11px] text-neutral-400 text-center font-mono">
        初始预置账号：<strong class="text-neutral-700 dark:text-neutral-300">admin</strong> / 密码：<strong class="text-neutral-700 dark:text-neutral-300">admin</strong>
    </div>
</div>
