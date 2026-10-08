<script lang="ts">
import { blogStore } from "../store.svelte";
import { authStore } from "../auth.svelte";
import Icon from "@components/common/icon.svelte";
import type { ConsoleTab } from "../types";

let {
    activeTab,
    onSelectTab,
    collapsed = false,
    onToggleCollapse,
    mobileOpen = false,
    onCloseMobile,
} = $props<{
    activeTab: ConsoleTab;
    onSelectTab: (tab: ConsoleTab) => void;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    mobileOpen?: boolean;
    onCloseMobile?: () => void;
}>();

interface NavItem {
    id: ConsoleTab;
    label: string;
    subLabel?: string;
    icon: string;
    perm: string;
    badge?: number;
    onClick?: () => void;
}

interface NavGroup {
    groupTitle: string;
    items: NavItem[];
}

// 侧边栏分组导航：采用截图中的5大分组视觉层次，但归位于专业博客管理功能
const navGroups = $derived<NavGroup[]>([
    {
        groupTitle: "运行",
        items: [
            {
                id: "dashboard",
                label: "仪表盘",
                subLabel: "大盘概览与监控",
                icon: "material-symbols:dashboard-outline",
                perm: "view:public",
            },
            {
                id: "editor",
                label: "快速创作",
                subLabel: "撰写新文章",
                icon: "material-symbols:bolt-outline",
                perm: "posts:create",
                onClick: () => {
                    blogStore.startEditing(null);
                    onSelectTab("editor");
                },
            },
        ],
    },
    {
        groupTitle: "内容管理",
        items: [
            {
                id: "posts",
                label: "文章管理",
                subLabel: "博文归档与发布",
                icon: "material-symbols:article-outline",
                perm: "view:public",
                badge: blogStore.stats.totalPosts,
            },
            {
                id: "categories",
                label: "分类目录",
                subLabel: "内容层级划分",
                icon: "material-symbols:folder-open-outline",
                perm: "view:public",
                badge: blogStore.categories.length,
            },
            {
                id: "tags",
                label: "文章标签",
                subLabel: "多维交叉索引",
                icon: "material-symbols:label-outline",
                perm: "view:public",
                badge: blogStore.tags.length,
            },
            {
                id: "attachments",
                label: "媒体素材",
                subLabel: "图片与资源附件",
                icon: "material-symbols:perm-media-outline",
                perm: "view:public",
                badge: blogStore.attachments.length,
            },
        ],
    },
    {
        groupTitle: "观测",
        items: [
            {
                id: "logs",
                label: "审计日志",
                subLabel: "安全与操作流水",
                icon: "material-symbols:receipt-long-outline",
                perm: "view:public",
                badge: blogStore.logs.length,
            },
        ],
    },
    {
        groupTitle: "控制",
        items: [
            {
                id: "settings",
                label: "站点配置",
                subLabel: "全局偏好与选项",
                icon: "material-symbols:tune",
                perm: "settings:*",
            },
            {
                id: "users",
                label: "用户管理",
                subLabel: "创作者与账户",
                icon: "material-symbols:group-outline",
                perm: "users:*",
                badge: authStore.users.length,
            },
            {
                id: "roles",
                label: "角色权限",
                subLabel: "RBAC 门禁策略",
                icon: "material-symbols:shield-person-outline",
                perm: "roles:*",
            },
            {
                id: "uc",
                label: "个人中心",
                subLabel: "资料与密码修改",
                icon: "material-symbols:account-circle-outline",
                perm: "view:public",
            },
        ],
    },
    {
        groupTitle: "运维",
        items: [
            {
                id: "keeper",
                label: "系统体检",
                subLabel: "健康诊断与备份",
                icon: "material-symbols:health-and-safety-outline",
                perm: "view:public",
            },
        ],
    },
]);
</script>

<aside
    class="
        fixed md:sticky top-0 left-0 z-50 md:z-30
        h-screen shrink-0 flex flex-col justify-between p-3 sm:p-4
        select-none border-r border-black/8 dark:border-white/5
        bg-white/85 dark:bg-[#0c0d12]/92 backdrop-blur-3xl
        text-neutral-800 dark:text-neutral-200 transition-all duration-300 ease-in-out
        {collapsed ? 'w-20' : 'w-64'}
        {mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
    "
>
    <!-- 折叠切换小按钮 (对应截图侧边栏右边缘正中悬浮的圆形药丸钮 <) -->
    <button
        type="button"
        class="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white dark:bg-[#181a20] text-neutral-500 dark:text-neutral-400 hover:text-emerald-500 dark:hover:text-emerald-400 border border-black/10 dark:border-white/10 shadow-xl items-center justify-center transition-all z-50 cursor-pointer hover:scale-110 active:scale-95"
        onclick={onToggleCollapse}
        title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
    >
        <span class="text-[11px] font-bold transition-transform duration-300 {collapsed ? 'rotate-180' : ''}">
            &lt;
        </span>
    </button>

    <div class="flex-1 overflow-y-auto overflow-x-hidden pr-0.5 custom-scrollbar">
        <!-- 侧边栏头部：Logo 与 控制台标题 (对应截图左上角 CPAMC 样式) -->
        <div class="px-2 py-3 mb-4 border-b border-black/8 dark:border-white/5 flex items-center justify-between">
            <div class="flex items-center gap-3 overflow-hidden">
                <!-- 科技感绿色渐变圆角图标 (带柔光边框) -->
                <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/25 to-teal-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-500 dark:text-emerald-400 font-black shadow-xs shrink-0">
                    <Icon icon="material-symbols:terminal" class="text-xl" />
                </div>
                {#if !collapsed}
                    <div class="min-w-0 transition-opacity duration-200">
                        <div class="font-black text-sm tracking-tight flex items-center gap-1.5 text-neutral-900 dark:text-white">
                            <span>BLOG CONSOLE</span>
                        </div>
                        <div class="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium truncate tracking-wide">
                            博客管理控制台 · v1.0.0
                        </div>
                    </div>
                {/if}
            </div>

            <!-- 移动端关闭抽屉按钮 -->
            <button
                type="button"
                class="md:hidden p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10"
                onclick={onCloseMobile}
                title="关闭抽屉"
                aria-label="关闭抽屉"
            >
                <Icon icon="material-symbols:close" class="text-base" />
            </button>
        </div>

        <!-- 菜单分组列表 -->
        <nav class="space-y-4">
            {#each navGroups as group}
                {@const visibleItems = group.items.filter(item => authStore.can(item.perm))}
                {#if visibleItems.length > 0}
                    <div class="space-y-1">
                        {#if !collapsed}
                            <div class="px-3 text-[10.5px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">
                                {group.groupTitle}
                            </div>
                        {:else}
                            <div class="w-full h-px bg-black/8 dark:bg-white/5 my-2"></div>
                        {/if}

                        {#each visibleItems as item}
                            {@const isActive = activeTab === item.id}
                            <button
                                type="button"
                                class="
                                    w-full flex items-center rounded-xl text-xs font-medium transition-all group relative cursor-pointer
                                    {collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'}
                                    {isActive
                                        ? 'bg-neutral-900/10 dark:bg-[#1a1e28] text-neutral-900 dark:text-white font-semibold shadow-xs border border-black/8 dark:border-white/10'
                                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-neutral-200'}
                                "
                                onclick={() => {
                                    if (item.onClick) item.onClick();
                                    else onSelectTab(item.id);
                                }}
                                title={collapsed ? `${item.label} (${item.subLabel || ''})` : undefined}
                            >
                                <div class="flex items-center gap-2.5 min-w-0">
                                    <Icon
                                        icon={item.icon}
                                        class="text-base shrink-0 transition-transform group-hover:scale-110 {isActive ? 'text-emerald-600 dark:text-emerald-400' : 'opacity-75 group-hover:opacity-100'}"
                                    />
                                    {#if !collapsed}
                                        <span class="truncate">{item.label}</span>
                                    {/if}
                                </div>

                                <!-- 徽章 (完全吻合截图中的暗底圆形药丸数字，如「4」) -->
                                {#if !collapsed && item.badge !== undefined && item.badge > 0}
                                    <span class="text-[10px] min-w-4 h-4 px-1 rounded-full font-mono font-bold flex items-center justify-center bg-black/5 dark:bg-[#181c24] text-neutral-600 dark:text-neutral-300 border border-black/8 dark:border-white/10">
                                        {item.badge}
                                    </span>
                                {:else if collapsed && item.badge !== undefined && item.badge > 0}
                                    <span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
                                {/if}
                            </button>
                        {/each}
                    </div>
                {/if}
            {/each}
        </nav>
    </div>

    <!-- 侧边栏底部用户信息条 (折叠时精简，展开时完整) -->
    <div class="pt-3 mt-2 border-t border-black/8 dark:border-white/5">
        {#if !collapsed}
            <div class="flex items-center justify-between p-2 rounded-xl bg-black/2 dark:bg-white/3 border border-black/5 dark:border-white/5">
                <div class="flex items-center gap-2.5 min-w-0">
                    <img
                        src={authStore.currentUser?.avatar || "/favicon.ico"}
                        alt={authStore.currentUser?.name}
                        class="w-7 h-7 rounded-full object-cover border border-emerald-500/30"
                    />
                    <div class="min-w-0">
                        <div class="text-xs font-semibold truncate text-neutral-800 dark:text-neutral-200">
                            {authStore.currentUser?.name || "管理员"}
                        </div>
                        <div class="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 truncate">
                            {authStore.currentUser?.role || "admin"}
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    onclick={() => onSelectTab("uc")}
                    title="个人中心"
                >
                    <Icon icon="material-symbols:settings-outline" class="text-sm" />
                </button>
            </div>
        {:else}
            <div class="flex justify-center">
                <img
                    src={authStore.currentUser?.avatar || "/favicon.ico"}
                    alt={authStore.currentUser?.name}
                    class="w-8 h-8 rounded-full object-cover border border-emerald-500/30 cursor-pointer"
                    onclick={() => onSelectTab("uc")}
                    title={authStore.currentUser?.name}
                />
            </div>
        {/if}
    </div>
</aside>
