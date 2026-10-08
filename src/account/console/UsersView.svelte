<script lang="ts">
import { authStore } from "../auth.svelte";
import { ROLE_INFO } from "../mockData";
import Icon from "@components/common/icon.svelte";
import type { UserRole } from "../types";

let newUsername = $state("");
let newName = $state("");
let newEmail = $state("");
let newRole = $state<UserRole>("author");
let newBio = $state("");

function handleCreateUser() {
    if (!newUsername.trim() || !newEmail.trim()) return;
    authStore.createUser({
        username: newUsername.trim(),
        name: newName.trim() || newUsername.trim(),
        email: newEmail.trim(),
        role: newRole,
        bio: newBio.trim(),
    });
    newUsername = "";
    newName = "";
    newEmail = "";
    newBio = "";
}

function handleRoleChange(userId: string, targetRole: UserRole) {
    authStore.updateUser(userId, { role: targetRole });
}

function handleDeleteUser(userId: string) {
    if (confirm("确定要删除该用户账号吗？")) {
        authStore.deleteUser(userId);
    }
}
</script>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 select-none">
    <!-- 新建用户表单 -->
    <div class="console-glass liquid-glass p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl space-y-4 text-xs bg-[#0f121a]/90 backdrop-blur-2xl">
        <h3 class="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
            <Icon icon="material-symbols:person-add-outline" class="text-lg text-emerald-400" />
            <span>添加新账户</span>
        </h3>

        <div>
            <label class="block font-semibold text-neutral-300 mb-1.5">登录用户名 *</label>
            <input
                type="text"
                placeholder="例如: developer_zhang"
                class="console-glass-input w-full px-3.5 py-2 text-xs font-mono bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                bind:value={newUsername}
            />
        </div>

        <div>
            <label class="block font-semibold text-neutral-300 mb-1.5">显示昵称</label>
            <input
                type="text"
                placeholder="例如: 张工"
                class="console-glass-input w-full px-3.5 py-2 text-xs bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                bind:value={newName}
            />
        </div>

        <div>
            <label class="block font-semibold text-neutral-300 mb-1.5">电子邮箱 *</label>
            <input
                type="email"
                placeholder="user@example.com"
                class="console-glass-input w-full px-3.5 py-2 text-xs font-mono bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                bind:value={newEmail}
            />
        </div>

        <div>
            <label class="block font-semibold text-neutral-300 mb-1.5">分配初始角色</label>
            <select
                class="console-glass-input w-full px-3.5 py-2 text-xs font-semibold bg-[#141720] border border-white/10 rounded-xl text-white cursor-pointer"
                bind:value={newRole}
            >
                <option value="admin">超级管理员 (admin)</option>
                <option value="editor">编辑者 (editor)</option>
                <option value="author">签约作者 (author)</option>
                <option value="contributor">投稿人 (contributor)</option>
                <option value="reader">普通读者 (reader - 无控制台权限)</option>
            </select>
        </div>

        <div>
            <label class="block font-semibold text-neutral-300 mb-1.5">个性签名 / 简介</label>
            <textarea
                placeholder="简短用户自我介绍..."
                class="console-glass-input w-full px-3.5 py-2 text-xs h-18 resize-none leading-relaxed bg-[#141720] border border-white/10 rounded-xl text-white placeholder-neutral-500"
                bind:value={newBio}
            ></textarea>
        </div>

        <button
            type="button"
            class="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-md transition-all hover:scale-102 active:scale-98 cursor-pointer"
            onclick={handleCreateUser}
        >
            确认创建用户
        </button>
    </div>

    <!-- 用户列表展示区 -->
    <div class="lg:col-span-2 console-glass liquid-glass p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl space-y-5 bg-[#0f121a]/90 backdrop-blur-2xl">
        <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 class="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                <span class="w-1.5 h-3.5 bg-emerald-500 rounded-full inline-block"></span>
                <span>用户账户列表 ({authStore.users.length})</span>
            </h3>
        </div>

        <div class="space-y-3">
            {#each authStore.users as user}
                <div class="console-glass-card p-4 rounded-2xl border border-white/10 bg-[#12151f]/80 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:border-emerald-500/30 transition-all">
                    <!-- 头像与核心信息 -->
                    <div class="flex items-center gap-3.5 min-w-0 flex-1">
                        <img
                            src={user.avatar}
                            alt={user.name}
                            class="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-white/15"
                        />
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-bold text-white text-sm truncate">{user.name}</span>
                                <span class="font-mono text-xs text-neutral-400">@{user.username}</span>
                                {#if user.id === authStore.currentUser?.id}
                                    <span class="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        当前在线
                                    </span>
                                {/if}
                            </div>
                            <div class="text-[11px] text-neutral-400 font-mono truncate mt-0.5">
                                {user.email}
                            </div>
                        </div>
                    </div>

                    <!-- 角色选择与删除按钮 -->
                    <div class="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                        <select
                            class="console-glass-input px-2.5 py-1 text-xs font-semibold bg-[#141720] border border-white/10 rounded-xl text-neutral-200 cursor-pointer"
                            value={user.role}
                            onchange={(e) => handleRoleChange(user.id, (e.target as HTMLSelectElement).value as UserRole)}
                            disabled={user.id === 'u-admin'}
                        >
                            <option value="admin">超级管理员</option>
                            <option value="editor">编辑者</option>
                            <option value="author">签约作者</option>
                            <option value="contributor">投稿人</option>
                            <option value="reader">普通读者</option>
                        </select>

                        {#if user.id !== 'u-admin' && user.id !== authStore.currentUser?.id}
                            <button
                                type="button"
                                class="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 border border-white/8 transition-colors cursor-pointer"
                                onclick={() => handleDeleteUser(user.id)}
                                title="删除用户"
                            >
                                <Icon icon="material-symbols:delete-outline" class="text-sm" />
                            </button>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>
