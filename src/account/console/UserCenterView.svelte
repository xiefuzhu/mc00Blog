<script lang="ts">
import { authStore } from "../auth.svelte";
import { ROLE_INFO } from "../mockData";
import Icon from "@components/common/icon.svelte";

let name = $state(authStore.currentUser?.name || "");
let email = $state(authStore.currentUser?.email || "");
let avatarUrl = $state(authStore.currentUser?.customAvatarUrl || authStore.currentUser?.avatar || "");
let bio = $state(authStore.currentUser?.bio || "");
let saveSuccess = $state(false);

// 修改密码状态
let currentPassword = $state("");
let newPassword = $state("");
let passwordFeedback = $state<string | null>(null);

function handleSave() {
    authStore.updateProfile({
        name: name.trim() || authStore.currentUser?.username,
        displayName: name.trim() || authStore.currentUser?.username,
        email: email.trim(),
        avatar: avatarUrl.trim() || authStore.currentUser?.avatar,
        customAvatarUrl: avatarUrl.trim(),
        bio: bio.trim(),
    });
    saveSuccess = true;
    setTimeout(() => {
        saveSuccess = false;
    }, 2500);
}

function handleUpdatePassword() {
    if (!newPassword.trim()) {
        passwordFeedback = "新密码不能为空";
        return;
    }
    if (authStore.currentUser) {
        authStore.updateUser(authStore.currentUser.id, {
            password: newPassword.trim(),
        });
        passwordFeedback = "密码已成功修改";
        currentPassword = "";
        newPassword = "";
        setTimeout(() => {
            passwordFeedback = null;
        }, 2500);
    }
}
</script>

<div class="max-w-3xl mx-auto space-y-6 text-xs select-none">
    <!-- 个人基本资料卡片 -->
    <div class="p-6 sm:p-7 console-glass liquid-glass rounded-3xl border border-white/10 shadow-xl space-y-5 bg-[#0f121a]/90 backdrop-blur-2xl">
        <div class="flex items-center gap-4 pb-4 border-b border-white/10">
            <div class="relative w-16 h-16 rounded-full overflow-hidden bg-emerald-500/10 border-2 border-emerald-500/30 shrink-0 shadow-md ring-2 ring-emerald-500/20">
                <img
                    src={avatarUrl || authStore.currentUser?.avatar}
                    alt={authStore.currentUser?.name}
                    class="w-full h-full object-cover"
                />
            </div>
            <div>
                <h3 class="text-base font-bold text-white">
                    {authStore.currentUser?.name}
                </h3>
                <div class="text-neutral-400 mt-1 flex items-center gap-2">
                    <span>登录账号: <code class="font-mono text-emerald-400 font-bold">{authStore.currentUser?.username}</code></span>
                    <span class={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${ROLE_INFO[authStore.currentUser?.role || 'reader']?.badgeColor}`}>
                        {ROLE_INFO[authStore.currentUser?.role || 'reader']?.label}
                    </span>
                </div>
            </div>
        </div>

        {#if saveSuccess}
            <div class="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-center font-mono">
                个人资料更新成功并已同步保存
            </div>
        {/if}

        <div class="space-y-4">
            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">显示名称 / 昵称</label>
                <input
                    type="text"
                    class="console-glass-input w-full px-3.5 py-2.5 text-xs bg-[#141720] border border-white/10 rounded-xl text-white"
                    bind:value={name}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">电子邮箱</label>
                <input
                    type="email"
                    class="console-glass-input w-full px-3.5 py-2.5 text-xs font-mono bg-[#141720] border border-white/10 rounded-xl text-white"
                    bind:value={email}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">头像图片链接 (URL)</label>
                <input
                    type="text"
                    placeholder="https://..."
                    class="console-glass-input w-full px-3.5 py-2.5 text-xs font-mono bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                    bind:value={avatarUrl}
                />
            </div>

            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">个性签名 / 简介</label>
                <textarea
                    class="console-glass-input w-full px-3.5 py-2.5 text-xs h-20 resize-none leading-relaxed bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                    placeholder="写几句话介绍一下自己吧..."
                    bind:value={bio}
                ></textarea>
            </div>

            <div class="pt-2 flex justify-end">
                <button
                    type="button"
                    class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-md transition-all hover:scale-102 active:scale-98 cursor-pointer"
                    onclick={handleSave}
                >
                    保存个人资料
                </button>
            </div>
        </div>
    </div>

    <!-- 安全与密码修改卡片 -->
    <div class="p-6 sm:p-7 console-glass liquid-glass rounded-3xl border border-white/10 shadow-xl space-y-4 bg-[#0f121a]/90 backdrop-blur-2xl">
        <h3 class="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
            <Icon icon="material-symbols:lock-outline" class="text-emerald-400 text-base" />
            <span>账户安全与密码修改</span>
        </h3>

        {#if passwordFeedback}
            <div class="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-center font-mono">
                {passwordFeedback}
            </div>
        {/if}

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
                <label class="block font-semibold text-neutral-300 mb-1.5">设置新密码</label>
                <input
                    type="password"
                    placeholder="输入新密码..."
                    class="console-glass-input w-full px-3.5 py-2 text-xs font-mono bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                    bind:value={newPassword}
                />
            </div>
            <div class="flex items-end">
                <button
                    type="button"
                    class="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition-colors cursor-pointer"
                    onclick={handleUpdatePassword}
                >
                    更新登录密码
                </button>
            </div>
        </div>
    </div>
</div>
