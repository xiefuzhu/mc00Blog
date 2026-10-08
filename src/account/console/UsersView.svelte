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

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 select-none text-neutral-900 dark:text-neutral-100">
    <!-- 新建用户表单 -->
    <div class="card-base liquid-glass p-5 sm:p-6 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl space-y-4 text-xs">
        <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-blue-500 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 pb-2 border-b border-black/5 dark:border-white/5">
            <h3 class="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <span>添加新账户</span>
            </h3>
        </div>

        <div>
            <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">登录用户名 *</label>
            <input
                type="text"
                placeholder="例如: developer_zhang"
                class="w-full px-3.5 py-2 text-xs font-mono card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-(--primary)/50"
                bind:value={newUsername}
            />
        </div>

        <div>
            <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">显示昵称</label>
            <input
                type="text"
                placeholder="例如: 张工"
                class="w-full px-3.5 py-2 text-xs card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-(--primary)/50"
                bind:value={newName}
            />
        </div>

        <div>
            <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">电子邮箱 *</label>
            <input
                type="email"
                placeholder="user@example.com"
                class="w-full px-3.5 py-2 text-xs font-mono card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-(--primary)/50"
                bind:value={newEmail}
            />
        </div>

        <div>
            <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">分配初始角色</label>
            <select
                class="w-full px-3.5 py-2 text-xs font-semibold card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl text-neutral-800 dark:text-neutral-200 cursor-pointer"
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
            <label class="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">个性签名 / 简介</label>
            <textarea
                placeholder="简短用户自我介绍..."
                class="w-full px-3.5 py-2 text-xs h-18 resize-none leading-relaxed card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-(--primary)/50"
                bind:value={newBio}
            ></textarea>
        </div>

        <button
            type="button"
            class="w-full py-2.5 rounded-xl bg-(--primary) hover:brightness-110 text-white font-bold text-xs shadow-md transition-all active:scale-98 cursor-pointer"
            onclick={handleCreateUser}
        >
            确认创建用户
        </button>
    </div>

    <!-- 用户列表展示区 -->
    <div class="lg:col-span-2 card-base liquid-glass p-5 sm:p-6 rounded-3xl border border-black/5 dark:border-white/8 shadow-xl space-y-5">
        <div class="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
            <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-(--primary) before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2">
                <h3 class="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    <span>用户账户列表 ({authStore.users.length})</span>
                </h3>
            </div>
        </div>

        <div class="space-y-3">
            {#each authStore.users as user}
                <div class="p-4 rounded-2xl border border-black/5 dark:border-white/8 bg-black/2 dark:bg-white/4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:border-(--primary)/40 transition-all">
                    <!-- 头像与核心信息 -->
                    <div class="flex items-center gap-3.5 min-w-0 flex-1">
                        <img
                            src={user.avatar}
                            alt={user.name}
                            class="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-(--primary)/30"
                        />
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-bold text-neutral-900 dark:text-white text-sm truncate">{user.name}</span>
                                <span class="font-mono text-xs text-neutral-400">@{user.username}</span>
                                {#if user.id === authStore.currentUser?.id}
                                    <span class="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                        当前在线
                                    </span>
                                {/if}
                            </div>
                            <div class="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono truncate mt-0.5">
                                {user.email}
                            </div>
                        </div>
                    </div>

                    <!-- 角色选择与删除按钮 -->
                    <div class="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                        <select
                            class="px-2.5 py-1 text-xs font-semibold card-base liquid-glass border border-black/8 dark:border-white/10 rounded-xl text-neutral-800 dark:text-neutral-200 cursor-pointer"
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
                                class="p-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-500 border border-black/5 dark:border-white/8 transition-colors cursor-pointer"
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
