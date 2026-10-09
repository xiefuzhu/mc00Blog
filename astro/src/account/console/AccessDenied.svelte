<script lang="ts">
import { authStore } from "../auth.svelte";
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";
import { ROLE_INFO } from "../mockData";

async function handleLogoutAndRelogin() {
    await authStore.logout();
}
</script>

<div class="w-full max-w-xl mx-auto my-16 p-8 sm:p-10 console-glass liquid-glass rounded-3xl border border-black/10 dark:border-white/10 text-center shadow-2xl select-none">
    <div class="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-5 border border-amber-500/20">
        <Icon icon="material-symbols:lock-person-outline" class="text-3xl" />
    </div>

    <h2 class="text-xl font-black text-neutral-900 dark:text-neutral-50 mb-2">
        控制台访问受限
    </h2>

    <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-6 leading-relaxed">
        当前登录身份 <span class="font-bold text-neutral-900 dark:text-neutral-100">{authStore.currentUser?.name || "未知用户"}</span> 
        所属角色为 <span class="font-bold text-amber-600 dark:text-amber-400">[{ROLE_INFO[authStore.currentUser?.role || 'reader']?.label || '普通读者'}]</span>。根据 Halo RBAC 安全策略，普通读者仅拥有前台浏览权限，未被授予管理控制台访问权。
    </p>

    <div class="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-xs text-left mb-6">
        <div class="font-bold text-neutral-700 dark:text-neutral-300 mb-1">[RBAC 角色权限策略说明]</div>
        <div class="text-neutral-500 dark:text-neutral-400 leading-relaxed space-y-1">
            <div>- 超级管理员 (admin) 与内容管理员 (editor)：拥有全量或内容管理控制台访问权；</div>
            <div>- 签约作者 (author) 与撰稿人 (contributor)：拥有文章创作与草稿提交权；</div>
            <div>- 普通读者 (reader)：仅拥有前台互动与个人中心权限，禁止进入控制台工作台。</div>
        </div>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
            variant="primary"
            size="md"
            icon="material-symbols:switch-account-outline"
            label="退出当前账号，以管理员身份登录"
            title="退出并重新登录"
            onclick={handleLogoutAndRelogin}
        />
        <Button
            variant="secondary"
            size="md"
            icon="material-symbols:arrow-back"
            label="返回博客前台主页"
            href="/"
            target="_self"
        />
    </div>
</div>
