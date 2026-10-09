<script lang="ts">
import { authStore } from "../auth.svelte";
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";

let { onSwitchToLogin } = $props<{
    onSwitchToLogin?: () => void;
}>();

let username = $state("");
let name = $state("");
let email = $state("");
let password = $state("");
let confirmPassword = $state("");
let showPassword = $state(false);

let isLoading = $state(false);
let errorMessage = $state("");
let successMessage = $state("");

async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    errorMessage = "";
    successMessage = "";

    const uname = username.trim().toLowerCase();
    const pwd = password.trim();
    const confirmPwd = confirmPassword.trim();
    const mail = email.trim();

    if (!uname || !pwd || !mail) {
        errorMessage = "用户名、电子邮箱与密码均为必填项";
        return;
    }

    if (pwd.length < 5) {
        errorMessage = "密码长度至少需要 5 个字符";
        return;
    }

    if (pwd !== confirmPwd) {
        errorMessage = "两次输入的密码不一致，请核对";
        return;
    }

    isLoading = true;
    try {
        const res = await authStore.register({
            username: uname,
            name: name.trim() || uname,
            email: mail,
            password: pwd,
        });

        if (res.success) {
            successMessage = res.message || "账号注册成功！正在转入登录...";
            setTimeout(() => {
                onSwitchToLogin?.();
            }, 1200);
        } else {
            errorMessage = res.message || "注册失败，请检查输入";
        }
    } catch {
        errorMessage = "网络或服务异常，请稍后重试";
    } finally {
        isLoading = false;
    }
}
</script>

<div class="w-full max-w-md mx-auto p-7 sm:p-9 console-glass liquid-glass rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl relative text-xs select-none">
    <!-- 顶栏标识 -->
    <div class="text-center mb-6">
        <div class="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Icon icon="material-symbols:person-add-outline" class="text-3xl" />
        </div>
        <h2 class="text-xl font-black text-neutral-900 dark:text-neutral-50 tracking-tight">
            注册 Halo 博客账号
        </h2>
        <p class="text-neutral-500 dark:text-neutral-400 mt-1">
            注册账号将默认获得读者（reader）身份
        </p>
    </div>

    <!-- 错误反馈提示 -->
    {#if errorMessage}
        <div class="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-2">
            <Icon icon="material-symbols:error-outline" class="text-base shrink-0" />
            <span>{errorMessage}</span>
        </div>
    {/if}

    <!-- 成功提示 -->
    {#if successMessage}
        <div class="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-2">
            <Icon icon="material-symbols:check-circle-outline" class="text-base shrink-0" />
            <span>{successMessage}</span>
        </div>
    {/if}

    <!-- 注册表单 -->
    <form onsubmit={handleSubmit} class="space-y-3.5">
        <div>
            <label for="reg-username" class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                账号用户名 *
            </label>
            <div class="relative">
                <input
                    id="reg-username"
                    type="text"
                    required
                    autocomplete="username"
                    placeholder="字母数字组合 (如 reader_zhang)"
                    class="console-field w-full pl-9 pr-3 font-mono"
                    bind:value={username}
                />
                <Icon icon="material-symbols:alternate-email" class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-base pointer-events-none" />
            </div>
        </div>

        <div>
            <label for="reg-name" class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                显示昵称 (可选)
            </label>
            <div class="relative">
                <input
                    id="reg-name"
                    type="text"
                    placeholder="例如: 阳光小读者"
                    class="console-field w-full pl-9 pr-3"
                    bind:value={name}
                />
                <Icon icon="material-symbols:badge-outline" class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-base pointer-events-none" />
            </div>
        </div>

        <div>
            <label for="reg-email" class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                电子邮箱 *
            </label>
            <div class="relative">
                <input
                    id="reg-email"
                    type="email"
                    required
                    autocomplete="email"
                    placeholder="your-name@example.com"
                    class="console-field w-full pl-9 pr-3 font-mono"
                    bind:value={email}
                />
                <Icon icon="material-symbols:mail-outline" class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-base pointer-events-none" />
            </div>
        </div>

        <div>
            <label for="reg-password" class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                登录密码 *
            </label>
            <div class="relative">
                <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autocomplete="new-password"
                    placeholder="至少 5 个字符"
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

        <div>
            <label for="reg-confirm-password" class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                确认登录密码 *
            </label>
            <div class="relative">
                <input
                    id="reg-confirm-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autocomplete="new-password"
                    placeholder="再次输入密码以确认"
                    class="console-field w-full pl-9 pr-3 font-mono"
                    bind:value={confirmPassword}
                />
                <Icon icon="material-symbols:lock-outline" class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-base pointer-events-none" />
            </div>
        </div>

        <div class="pt-2">
            <Button
                variant="primary"
                size="md"
                block
                type="submit"
                icon={isLoading ? "eos-icons:loading" : "material-symbols:how-to-reg"}
                iconClass={isLoading ? "text-base animate-spin" : "text-base"}
                label={isLoading ? "正在注册账号..." : "提交并注册账号"}
                title="提交注册"
                disabled={isLoading}
            />
        </div>
    </form>

    <!-- 底部操作与引导 -->
    <div class="mt-6 pt-4 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
        <Button
            variant="ghost"
            size="sm"
            label="已有账号？立即登录"
            title="切换到登录"
            onclick={onSwitchToLogin}
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
</div>
