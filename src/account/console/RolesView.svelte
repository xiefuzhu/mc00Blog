<script lang="ts">
import { authStore } from "../auth.svelte";
import Icon from "@components/common/icon.svelte";

const permissionLabels: Record<string, string> = {
    "*": "全站所有系统与数据权限 (通配符)",
    "posts:*": "全量文章读写与删改",
    "posts:create": "新建文章",
    "posts:edit:own": "编辑本人文章",
    "posts:delete:own": "删除本人文章",
    "posts:publish": "公开发布文章",
    "categories:*": "全量分类管理",
    "tags:*": "全量标签管理",
    "attachments:*": "附件与图床读写",
    "users:*": "多用户账号管理",
    "roles:*": "RBAC 角色权限体系配置",
    "settings:*": "系统与站点设置",
    "view:public": "前台公开内容浏览",
};
</script>

<div class="space-y-6 select-none">
    <!-- RBAC 概念引导横幅 -->
    <div class="console-glass liquid-glass p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0f121a]/90 backdrop-blur-2xl">
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/25">
                <Icon icon="material-symbols:shield-person-outline" class="text-2xl" />
            </div>
            <div>
                <h3 class="text-sm font-bold text-white">
                    Halo 2.0 RBAC 角色与权限策略体系
                </h3>
                <p class="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                    基于角色的访问控制（Role-Based Access Control），通过角色解耦用户与权限粒度，支持 Console 物理路由门禁。
                </p>
            </div>
        </div>
    </div>

    <!-- 角色卡片列表 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        {#each authStore.roles as role}
            <div class="console-glass-card p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl bg-[#121520]/85 backdrop-blur-xl flex flex-col justify-between hover:border-emerald-500/30 transition-all">
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <h4 class="text-sm font-bold text-white">
                                {role.name}
                            </h4>
                            <span class="text-[10px] font-mono text-emerald-400">({role.id})</span>
                        </div>
                        {#if role.isSystem}
                            <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-neutral-400 font-semibold border border-white/8 font-mono">
                                系统内置
                            </span>
                        {/if}
                    </div>

                    <p class="text-xs text-neutral-400 mb-3.5 leading-relaxed">
                        {role.description}
                    </p>

                    <!-- Console 门禁状态 -->
                    <div class="mb-4 flex items-center gap-2 text-xs">
                        <span class="text-neutral-400 font-medium">控制台门禁:</span>
                        {#if role.disallowAccessConsole}
                            <span class="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-semibold text-[10px] border border-rose-500/25">
                                禁止访问 Console 控制台
                            </span>
                        {:else}
                            <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold text-[10px] border border-emerald-500/25">
                                允许访问 Console 控制台
                            </span>
                        {/if}
                    </div>

                    <!-- 权限清单列表 -->
                    <div class="space-y-1.5">
                        <span class="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                            赋予的权限规则列表:
                        </span>
                        <div class="flex flex-wrap gap-1.5">
                            {#each role.permissions as perm}
                                <span
                                    class="text-[10.5px] px-2.5 py-1 rounded-xl bg-[#171b26] border border-white/8 text-neutral-300 font-mono"
                                    title={permissionLabels[perm] || perm}
                                >
                                    {perm}
                                </span>
                            {/each}
                        </div>
                    </div>
                </div>
            </div>
        {/each}
    </div>
</div>
