<script lang="ts">
import { onMount } from "svelte";
import dayjs from "dayjs";
import { blogStore } from "../store.svelte";
import Icon from "@components/common/icon.svelte";
import Button from "./Button.svelte";
import type { ConsoleTab } from "../types";

let { onSelectTab } = $props<{
    onSelectTab: (tab: ConsoleTab) => void;
}>();

// 图表 DOM 引用
let activityContainer = $state<HTMLDivElement>();
let categoriesContainer = $state<HTMLDivElement>();
let tagsContainer = $state<HTMLDivElement>();

// ECharts 实例引用
let echarts: any = $state();
let activityChart: any = $state();
let categoriesChart: any = $state();
let tagsChart: any = $state();

let isActivityLoading = $state(true);
let isCategoriesLoading = $state(true);
let isTagsLoading = $state(true);

let timeScale: "year" | "month" | "day" = $state("year");

const getThemeColors = () => {
    const isDarkNow = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    return {
        text: isDarkNow ? "#e5e7eb" : "#374151",
        primary: isDarkNow ? "#60a5fa" : "#3b82f6",
        grid: isDarkNow ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        areaStart: isDarkNow ? "rgba(96, 165, 250, 0.45)" : "rgba(59, 130, 246, 0.45)",
        areaEnd: isDarkNow ? "rgba(96, 165, 250, 0.02)" : "rgba(59, 130, 246, 0.02)",
    };
};

const getChartsFontFamily = () => {
    const fallback = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    if (typeof window === "undefined") return fallback;
    const fontFamily = window.getComputedStyle(document.body).fontFamily;
    return fontFamily && fontFamily !== "inherit" ? fontFamily : fallback;
};

const loadECharts = async () => {
    if (typeof window === "undefined") return;
    const echartsCore = await import("echarts/core");
    const { LineChart, RadarChart } = await import("echarts/charts");
    const { TitleComponent, TooltipComponent, GridComponent, LegendComponent } = await import("echarts/components");
    const { SVGRenderer } = await import("echarts/renderers");

    echartsCore.use([
        LineChart,
        RadarChart,
        TitleComponent,
        TooltipComponent,
        GridComponent,
        LegendComponent,
        SVGRenderer
    ]);

    echarts = echartsCore;
};

// 1. 初始化发布活动走势折线图
const renderActivityChart = () => {
    if (!activityContainer || !echarts) return;

    let existing = echarts.getInstanceByDom(activityContainer);
    if (existing) {
        activityChart = existing;
    } else {
        activityChart = echarts.init(activityContainer, null, { renderer: "svg" });
    }

    const colors = getThemeColors();
    const fontFamily = getChartsFontFamily();
    const now = dayjs();
    const publishedPosts = blogStore.posts.filter(p => p.status === "published");

    let data: number[] = [];
    let xAxisData: string[] = [];

    if (timeScale === "year") {
        const oldestYear = publishedPosts.length > 0
            ? Math.min(...publishedPosts.map(p => dayjs(p.createdAt || p.updatedAt).year()))
            : now.year() - 4;
        const currentYear = now.year();
        const startYear = Math.min(oldestYear, currentYear - 4);

        for (let year = startYear; year <= currentYear; year++) {
            xAxisData.push(year.toString());
            const count = publishedPosts.filter(p => dayjs(p.createdAt || p.updatedAt).year() === year).length;
            data.push(count);
        }
    } else if (timeScale === "month") {
        for (let i = 11; i >= 0; i--) {
            const month = now.subtract(i, "month");
            const monthStr = month.format("YYYY-MM");
            xAxisData.push(month.format("MMM"));
            const count = publishedPosts.filter(p => dayjs(p.createdAt || p.updatedAt).format("YYYY-MM") === monthStr).length;
            data.push(count);
        }
    } else {
        for (let i = 29; i >= 0; i--) {
            const day = now.subtract(i, "day");
            const dayStr = day.format("YYYY-MM-DD");
            xAxisData.push(day.format("DD"));
            const count = publishedPosts.filter(p => dayjs(p.createdAt || p.updatedAt).format("YYYY-MM-DD") === dayStr).length;
            data.push(count);
        }
    }

    activityChart.setOption({
        backgroundColor: "transparent",
        textStyle: { fontFamily },
        animationDuration: 1000,
        animationEasing: "cubicOut",
        tooltip: {
            trigger: "axis",
            confine: true,
            formatter: (params: any) => `${params[0].name}: <strong>${params[0].value}</strong> 篇文章`
        },
        grid: { left: "4%", right: "4%", bottom: "10%", top: "15%", containLabel: true },
        xAxis: {
            type: "category",
            data: xAxisData,
            axisLine: { lineStyle: { color: colors.grid } },
            axisLabel: { fontFamily, color: colors.text, fontSize: 11 }
        },
        yAxis: {
            type: "value",
            minInterval: 1,
            axisLine: { show: false },
            axisLabel: { fontFamily, color: colors.text, fontSize: 11 },
            splitLine: { lineStyle: { color: colors.grid, type: "dashed" } }
        },
        series: [{
            name: "发布篇数",
            data,
            type: "line",
            smooth: true,
            symbol: "circle",
            symbolSize: 6,
            itemStyle: { color: colors.primary },
            lineStyle: { width: 3, color: colors.primary },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: colors.areaStart },
                    { offset: 1, color: colors.areaEnd }
                ])
            }
        }]
    }, true);

    isActivityLoading = false;
};

// 2. 初始化分类雷达图
const renderCategoriesChart = () => {
    if (!categoriesContainer || !echarts) return;

    let existing = echarts.getInstanceByDom(categoriesContainer);
    if (existing) {
        categoriesChart = existing;
    } else {
        categoriesChart = echarts.init(categoriesContainer, null, { renderer: "svg" });
    }

    const colors = getThemeColors();
    const fontFamily = getChartsFontFamily();
    const cats = blogStore.categories;

    if (!cats || cats.length === 0) return;

    const counts = cats.map(c => {
        const count = blogStore.posts.filter(p => p.status !== "recycle" && p.categories?.includes(c.id)).length;
        return count || c.postCount || 0;
    });
    const maxVal = Math.max(...counts, 5);
    const indicator = cats.map(c => ({ name: c.name, max: maxVal }));

    categoriesChart.setOption({
        backgroundColor: "transparent",
        textStyle: { fontFamily },
        animationDuration: 1200,
        animationEasing: "exponentialOut",
        tooltip: {
            trigger: "item",
            confine: true
        },
        radar: {
            indicator,
            radius: "60%",
            center: ["50%", "58%"],
            axisName: { fontFamily, color: colors.text, fontSize: 11, fontWeight: "bold" },
            splitLine: { lineStyle: { color: colors.grid } },
            splitArea: { show: false }
        },
        series: [{
            type: "radar",
            data: [{ value: counts, name: "分类覆盖" }],
            areaStyle: { color: "rgba(255, 123, 0, 0.6)" },
            lineStyle: { color: "rgba(255, 123, 0, 0.9)", width: 2 },
            itemStyle: { color: "rgba(255, 123, 0, 0.9)" },
            emphasis: {
                areaStyle: { color: "rgba(255, 123, 0, 0.9)" }
            }
        }]
    }, true);

    isCategoriesLoading = false;
};

// 3. 初始化标签雷达图
const renderTagsChart = () => {
    if (!tagsContainer || !echarts) return;

    let existing = echarts.getInstanceByDom(tagsContainer);
    if (existing) {
        tagsChart = existing;
    } else {
        tagsChart = echarts.init(tagsContainer, null, { renderer: "svg" });
    }

    const colors = getThemeColors();
    const fontFamily = getChartsFontFamily();
    const tags = blogStore.tags;

    if (!tags || tags.length === 0) return;

    const sortedTags = [...tags].sort((a, b) => {
        const countA = blogStore.posts.filter(p => p.status !== "recycle" && p.tags?.includes(a.id)).length || a.postCount || 0;
        const countB = blogStore.posts.filter(p => p.status !== "recycle" && p.tags?.includes(b.id)).length || b.postCount || 0;
        return countB - countA;
    }).slice(0, 8);

    const counts = sortedTags.map(t => {
        const count = blogStore.posts.filter(p => p.status !== "recycle" && p.tags?.includes(t.id)).length;
        return count || t.postCount || 0;
    });
    const maxVal = Math.max(...counts, 5);
    const indicator = sortedTags.map(t => ({ name: t.name, max: maxVal }));

    tagsChart.setOption({
        backgroundColor: "transparent",
        textStyle: { fontFamily },
        animationDuration: 1200,
        animationEasing: "exponentialOut",
        tooltip: {
            trigger: "item",
            confine: true
        },
        radar: {
            indicator,
            radius: "60%",
            center: ["50%", "58%"],
            axisName: { fontFamily, color: colors.text, fontSize: 11, fontWeight: "bold" },
            splitLine: { lineStyle: { color: colors.grid } },
            splitArea: { show: false }
        },
        series: [{
            type: "radar",
            data: [{ value: counts, name: "标签分布" }],
            areaStyle: { color: "rgba(16, 185, 129, 0.6)" },
            lineStyle: { color: "rgba(16, 185, 129, 0.9)", width: 2 },
            itemStyle: { color: "rgba(16, 185, 129, 0.9)" },
            emphasis: {
                areaStyle: { color: "rgba(16, 185, 129, 0.9)" }
            }
        }]
    }, true);

    isTagsLoading = false;
};

const updateAllCharts = () => {
    renderActivityChart();
    renderCategoriesChart();
    renderTagsChart();
};

onMount(() => {
    let resizeTimer: any;
    const handleResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            activityChart?.resize();
            categoriesChart?.resize();
            tagsChart?.resize();
        }, 150);
    };

    window.addEventListener("resize", handleResize);

    // 观察深色模式切换并重新着色
    const observer = new MutationObserver(() => {
        updateAllCharts();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    loadECharts().then(() => {
        updateAllCharts();
    });

    return () => {
        window.removeEventListener("resize", handleResize);
        observer.disconnect();
        activityChart?.dispose();
        categoriesChart?.dispose();
        tagsChart?.dispose();
    };
});

// 响应数据及时间跨度变化更新图表
$effect(() => {
    const _p = blogStore.posts.length;
    const _c = blogStore.categories.length;
    const _t = blogStore.tags.length;
    const _scale = timeScale;
    if (echarts) {
        updateAllCharts();
    }
});

const recentPosts = $derived(blogStore.posts.slice(0, 5));
</script>

<div class="space-y-6 sm:space-y-8 select-none text-neutral-900 dark:text-neutral-100">
    <!-- ========================================================================
         1. 顶部 Hero 状态栏与概览
         ======================================================================== -->
    <section class="card-base liquid-glass rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-black/5 dark:border-white/8 shadow-xl">
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div class="space-y-3">
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        运行平稳 · 站点同步正常
                    </span>
                    <span class="text-xs text-neutral-400 font-mono">v1.2.0</span>
                </div>
                <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-neutral-900 dark:text-white flex items-baseline gap-2">
                    <span>博客工作台</span>
                    <span class="inline-block w-3 h-3 rounded-full bg-(--primary) shadow-[0_0_10px_var(--primary)]"></span>
                </h1>
                <p class="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-xl">
                    与前台博客数据实时保持一致。当前共收录 {blogStore.stats.publishedCount} 篇发布博文、{blogStore.categories.length} 个分类目录及 {blogStore.tags.length} 个标签索引。
                </p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
                <Button
                    variant="primary"
                    size="lg"
                    icon="material-symbols:edit-document-outline"
                    label="撰写新文章"
                    title="打开快速创作"
                    onclick={() => { blogStore.startEditing(null); onSelectTab("editor"); }}
                />
                <Button
                    variant="secondary"
                    size="lg"
                    icon="material-symbols:article-outline"
                    label="文章列表"
                    title="打开文章管理"
                    onclick={() => onSelectTab("posts")}
                />
            </div>
        </div>
    </section>

    <!-- ========================================================================
         2. 核心统计指标卡片 (4 列)
         ======================================================================== -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <!-- 卡片 1: 公开发布博文 -->
        <div class="card-base liquid-glass rounded-2xl p-5 border border-black/5 dark:border-white/8 shadow-md flex flex-col justify-between">
            <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">公开博文</span>
                <div class="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <Icon icon="material-symbols:article-outline" class="text-lg" />
                </div>
            </div>
            <div class="my-3">
                <span class="text-3xl sm:text-4xl font-black font-mono text-neutral-900 dark:text-white">
                    {blogStore.stats.publishedCount}
                </span>
                <span class="text-xs text-neutral-400 font-mono ml-1">/ {blogStore.posts.length} 篇</span>
            </div>
            <div class="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-2">
                <span>草稿数量</span>
                <span class="font-mono font-bold text-amber-500">{blogStore.stats.draftCount} 篇</span>
            </div>
        </div>

        <!-- 卡片 2: 分类目录 -->
        <div class="card-base liquid-glass rounded-2xl p-5 border border-black/5 dark:border-white/8 shadow-md flex flex-col justify-between">
            <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">分类目录</span>
                <div class="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                    <Icon icon="material-symbols:folder-outline" class="text-lg" />
                </div>
            </div>
            <div class="my-3">
                <span class="text-3xl sm:text-4xl font-black font-mono text-neutral-900 dark:text-white">
                    {blogStore.categories.length}
                </span>
                <span class="text-xs text-neutral-400 font-mono ml-1">个专栏</span>
            </div>
            <div class="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-2">
                <span>最高覆盖</span>
                <span class="font-bold text-neutral-700 dark:text-neutral-300">示例 (5篇)</span>
            </div>
        </div>

        <!-- 卡片 3: 文章标签 -->
        <div class="card-base liquid-glass rounded-2xl p-5 border border-black/5 dark:border-white/8 shadow-md flex flex-col justify-between">
            <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">文章标签</span>
                <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Icon icon="material-symbols:label-outline" class="text-lg" />
                </div>
            </div>
            <div class="my-3">
                <span class="text-3xl sm:text-4xl font-black font-mono text-neutral-900 dark:text-white">
                    {blogStore.tags.length}
                </span>
                <span class="text-xs text-neutral-400 font-mono ml-1">个标签</span>
            </div>
            <div class="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-2">
                <span>涵盖范畴</span>
                <span class="font-bold text-neutral-700 dark:text-neutral-300">防拷 / 加密 / 折扣</span>
            </div>
        </div>

        <!-- 卡片 4: 媒体素材 -->
        <div class="card-base liquid-glass rounded-2xl p-5 border border-black/5 dark:border-white/8 shadow-md flex flex-col justify-between">
            <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">媒体素材</span>
                <div class="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <Icon icon="material-symbols:photo-library-outline" class="text-lg" />
                </div>
            </div>
            <div class="my-3">
                <span class="text-3xl sm:text-4xl font-black font-mono text-neutral-900 dark:text-white">
                    {blogStore.attachments.length}
                </span>
                <span class="text-xs text-neutral-400 font-mono ml-1">份资源</span>
            </div>
            <div class="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-2">
                <span>总创作字数</span>
                <span class="font-mono font-bold text-neutral-700 dark:text-neutral-300">{blogStore.stats.totalWords} 字</span>
            </div>
        </div>
    </section>

    <!-- ========================================================================
         3. 核心统计图表 (活动走势折线图与双雷达图)
         ======================================================================== -->
    <section class="space-y-6">
        <!-- 图表 1: 发布活动走势折线图 (完全对齐前台侧边栏 Activities) -->
        <div class="card-base liquid-glass rounded-3xl p-6 sm:p-7 border border-black/5 dark:border-white/8 shadow-xl">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-(--primary) before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2">
                    <h2 class="text-base font-bold text-neutral-900 dark:text-white">发布活动走势</h2>
                    <p class="text-xs text-neutral-400">与博客侧边栏完全一致的发布活跃度走势分析</p>
                </div>

                <!-- 尺度切换胶囊选择器 (年 / 月 / 日) -->
                <div class="flex items-center gap-1 p-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 self-start sm:self-auto">
                    <button
                        type="button"
                        class="console-chip {timeScale === 'year' ? 'is-active' : ''}"
                        onclick={() => { timeScale = "year"; }}
                    >
                        按年
                    </button>
                    <button
                        type="button"
                        class="console-chip {timeScale === 'month' ? 'is-active' : ''}"
                        onclick={() => { timeScale = "month"; }}
                    >
                        按月
                    </button>
                    <button
                        type="button"
                        class="console-chip {timeScale === 'day' ? 'is-active' : ''}"
                        onclick={() => { timeScale = "day"; }}
                    >
                        按日
                    </button>
                </div>
            </div>

            <div class="relative w-full h-64 sm:h-72">
                <div bind:this={activityContainer} class="w-full h-full transition-opacity duration-300" class:opacity-0={isActivityLoading}></div>
                {#if isActivityLoading}
                    <div class="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
                        正在渲染折线图...
                    </div>
                {/if}
            </div>
        </div>

        <!-- 图表 2 & 3: 分类雷达图与标签雷达图 (双列对齐) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- 分类分布雷达图 -->
            <div class="card-base liquid-glass rounded-3xl p-6 sm:p-7 border border-black/5 dark:border-white/8 shadow-xl flex flex-col justify-between">
                <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-orange-500 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 mb-2">
                    <h2 class="text-base font-bold text-neutral-900 dark:text-white">分类覆盖雷达</h2>
                    <p class="text-xs text-neutral-400">全站博文在各分类专栏的深度分布</p>
                </div>
                <div class="relative w-full h-64">
                    <div bind:this={categoriesContainer} class="w-full h-full transition-opacity duration-300" class:opacity-0={isCategoriesLoading}></div>
                    {#if isCategoriesLoading}
                        <div class="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
                            正在生成分类雷达...
                        </div>
                    {/if}
                </div>
            </div>

            <!-- 标签分布雷达图 -->
            <div class="card-base liquid-glass rounded-3xl p-6 sm:p-7 border border-black/5 dark:border-white/8 shadow-xl flex flex-col justify-between">
                <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-emerald-500 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 mb-2">
                    <h2 class="text-base font-bold text-neutral-900 dark:text-white">标签覆盖雷达</h2>
                    <p class="text-xs text-neutral-400">热门主题标签的渗透与使用频度</p>
                </div>
                <div class="relative w-full h-64">
                    <div bind:this={tagsContainer} class="w-full h-full transition-opacity duration-300" class:opacity-0={isTagsLoading}></div>
                    {#if isTagsLoading}
                        <div class="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
                            正在生成标签雷达...
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </section>

    <!-- ========================================================================
         4. 底部最新文章动态与快捷管理入口
         ======================================================================== -->
    <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- 左侧：最新发布文章 (8 列) -->
        <div class="lg:col-span-8 card-base liquid-glass rounded-3xl p-6 sm:p-7 border border-black/5 dark:border-white/8 shadow-xl space-y-4">
            <div class="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-(--primary) before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2">
                    <h3 class="text-base font-bold text-neutral-900 dark:text-white">最近文章动态</h3>
                    <p class="text-xs text-neutral-400">已收录的真实博文清单与元数据</p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    icon="material-symbols:arrow-forward"
                    iconClass="text-sm order-2"
                    label="查看全部"
                    title="查看全部文章"
                    onclick={() => onSelectTab("posts")}
                />
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead>
                        <tr class="text-neutral-400 dark:text-neutral-500 border-b border-black/5 dark:border-white/5 text-[11px] font-mono">
                            <th class="py-2.5 font-medium">文章标题</th>
                            <th class="py-2.5 font-medium">分类</th>
                            <th class="py-2.5 font-medium">标签</th>
                            <th class="py-2.5 font-medium">状态</th>
                            <th class="py-2.5 font-medium text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-black/5 dark:divide-white/5">
                        {#each recentPosts as post}
                            <tr class="hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
                                <td class="py-3 pr-2 font-medium text-neutral-800 dark:text-neutral-200 max-w-[200px] truncate">
                                    <span class="hover:text-(--primary) cursor-pointer" onclick={() => { blogStore.startEditing(post.id); onSelectTab("editor"); }}>
                                        {post.title}
                                    </span>
                                </td>
                                <td class="py-3 pr-2 text-neutral-500 dark:text-neutral-400 text-[11px]">
                                    {#if post.categories?.[0]}
                                        <span class="inline-block px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">
                                            {blogStore.categoriesMap.get(post.categories[0]) || post.categories[0]}
                                        </span>
                                    {:else}
                                        <span class="text-neutral-400">未分类</span>
                                    {/if}
                                </td>
                                <td class="py-3 pr-2">
                                    <div class="flex flex-wrap gap-1">
                                        {#if post.tags && post.tags.length > 0}
                                            {#each post.tags.slice(0, 2) as tagId}
                                                <span class="inline-block px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono">
                                                    #{blogStore.tagsMap.get(tagId) || tagId}
                                                </span>
                                            {/each}
                                        {:else}
                                            <span class="text-neutral-400 text-[11px]">-</span>
                                        {/if}
                                    </div>
                                </td>
                                <td class="py-3 pr-2">
                                    <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-bold {post.status === 'published' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'}">
                                        {post.status === 'published' ? '已发布' : '草稿'}
                                    </span>
                                </td>
                                <td class="py-3 text-right">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        label="编辑"
                                        title="编辑此文章"
                                        onclick={() => { blogStore.startEditing(post.id); onSelectTab("editor"); }}
                                    />
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- 右侧：快捷入口 (4 列) -->
        <div class="lg:col-span-4 card-base liquid-glass rounded-3xl p-6 sm:p-7 border border-black/5 dark:border-white/8 shadow-xl flex flex-col justify-between space-y-4">
            <div class="space-y-4">
                <div class="relative pl-3 before:w-1 before:h-4 before:rounded-md before:bg-cyan-500 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 border-b border-black/5 dark:border-white/5 pb-3">
                    <h3 class="text-base font-bold text-neutral-900 dark:text-white">快捷导航</h3>
                    <p class="text-xs text-neutral-400">直达各个常用系统管理功能</p>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        class="p-3.5 rounded-2xl bg-black/2 dark:bg-white/4 border border-black/5 dark:border-white/5 hover:bg-(--btn-plain-bg-hover) hover:border-(--primary)/40 text-left transition-all cursor-pointer group"
                        onclick={() => { blogStore.startEditing(null); onSelectTab("editor"); }}
                    >
                        <Icon icon="material-symbols:edit-document-outline" class="text-2xl text-(--primary) mb-1.5 group-hover:scale-110 transition-transform" />
                        <div class="font-bold text-xs text-neutral-800 dark:text-neutral-200">撰写文章</div>
                        <div class="text-[10px] text-neutral-400">实时 Markdown 编辑</div>
                    </button>

                    <button
                        type="button"
                        class="p-3.5 rounded-2xl bg-black/2 dark:bg-white/4 border border-black/5 dark:border-white/5 hover:bg-(--btn-plain-bg-hover) hover:border-(--primary)/40 text-left transition-all cursor-pointer group"
                        onclick={() => onSelectTab("categories")}
                    >
                        <Icon icon="material-symbols:folder-outline" class="text-2xl text-(--primary) mb-1.5 group-hover:scale-110 transition-transform" />
                        <div class="font-bold text-xs text-neutral-800 dark:text-neutral-200">分类与标签</div>
                        <div class="text-[10px] text-neutral-400">分类目录体系管理</div>
                    </button>

                    <button
                        type="button"
                        class="p-3.5 rounded-2xl bg-black/2 dark:bg-white/4 border border-black/5 dark:border-white/5 hover:bg-(--btn-plain-bg-hover) hover:border-(--primary)/40 text-left transition-all cursor-pointer group"
                        onclick={() => onSelectTab("attachments")}
                    >
                        <Icon icon="material-symbols:photo-library-outline" class="text-2xl text-(--primary) mb-1.5 group-hover:scale-110 transition-transform" />
                        <div class="font-bold text-xs text-neutral-800 dark:text-neutral-200">媒体图库</div>
                        <div class="text-[10px] text-neutral-400">封面与插图管理</div>
                    </button>

                    <button
                        type="button"
                        class="p-3.5 rounded-2xl bg-black/2 dark:bg-white/4 border border-black/5 dark:border-white/5 hover:bg-(--btn-plain-bg-hover) hover:border-(--primary)/40 text-left transition-all cursor-pointer group"
                        onclick={() => onSelectTab("settings")}
                    >
                        <Icon icon="material-symbols:settings-outline" class="text-2xl text-(--primary) mb-1.5 group-hover:scale-110 transition-transform" />
                        <div class="font-bold text-xs text-neutral-800 dark:text-neutral-200">站点设置</div>
                        <div class="text-[10px] text-neutral-400">全站标题与全局配置</div>
                    </button>
                </div>
            </div>

            <div class="pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] text-neutral-400">
                <span>当前登录身份</span>
                <span class="font-bold text-neutral-700 dark:text-neutral-300 font-mono">管理员</span>
            </div>
        </div>
    </section>
</div>
