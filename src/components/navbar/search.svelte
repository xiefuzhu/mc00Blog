<script lang="ts">
import { onMount, onDestroy } from "svelte";

import type { SearchResult } from "@/global";
import { url } from "@utils/url";
import { navigateToPage } from "@utils/navigation";
import { onClickOutside } from "@utils/widget";
import { i18n } from "@i18n/translation";
import I18nKey from "@i18n/i18nKey";
import DropdownPanel from "@/components/common/DropdownPanel.svelte";
import Icon from "@components/common/icon.svelte";

let keywordDesktop = $state("");
let keywordMobile = $state("");
let result: SearchResult[] = $state([]);
let isSearching = $state(false);
let pagefindLoaded = false;
let initialized = $state(false);
let isDesktopSearchExpanded = $state(false);
let debounceTimer: NodeJS.Timeout;

const fakeResult: SearchResult[] = [
    {
        url: url("/"),
        meta: {
            title: "This Is a Fake Search Result",
        },
        excerpt:
            "Because the search cannot work in the <mark>dev</mark> environment.",
    },
    {
        url: url("/"),
        meta: {
            title: "If You Want to Test the Search",
        },
        excerpt: "Try running <mark>npm build && npm preview</mark> instead.",
    },
];

const togglePanel = () => {
    const panel = document.getElementById("search-panel");
    const isClosed = panel?.classList.contains("float-panel-closed");
    panel?.classList.toggle("float-panel-closed");
    if (isClosed) {
        setTimeout(() => {
            const mobileInput = document.querySelector("#search-bar-inside input") as HTMLInputElement;
            mobileInput?.focus();
        }, 60);
    }
};

const toggleDesktopSearch = () => {
    isDesktopSearchExpanded = !isDesktopSearchExpanded;
    if (isDesktopSearchExpanded) {
        setTimeout(() => {
            const input = document.getElementById("search-input-desktop") as HTMLInputElement;
            input?.focus();
        }, 0);
    }
};

const collapseDesktopSearch = () => {
    if (!keywordDesktop) {
        isDesktopSearchExpanded = false;
    }
};

const handleBlur = () => {
    setTimeout(() => {
        isDesktopSearchExpanded = false;
        setPanelVisibility(false, true);
    }, 200);
};

const setPanelVisibility = (show: boolean, isDesktop: boolean): void => {
    const panel = document.getElementById("search-panel");
    if (!panel || !isDesktop) return;
    if (show) {
        panel.classList.remove("float-panel-closed");
    } else {
        panel.classList.add("float-panel-closed");
    }
};

const closeSearchPanel = (): void => {
    const panel = document.getElementById("search-panel");
    if (panel) {
        panel.classList.add("float-panel-closed");
    }
    keywordDesktop = "";
    keywordMobile = "";
    result = [];
};

const handleResultClick = (event: Event, targetUrl: string): void => {
    event.preventDefault();
    closeSearchPanel();
    navigateToPage(targetUrl);
};

const search = async (keyword: string, isDesktop: boolean): Promise<void> => {
    if (!keyword) {
        setPanelVisibility(false, isDesktop);
        result = [];
        return;
    }
    if (!initialized) {
        return;
    }
    isSearching = true;
    try {
        let searchResults: SearchResult[] = [];
        if (import.meta.env.PROD && pagefindLoaded && window.pagefind) {
            const response = await window.pagefind.search(keyword);
            searchResults = await Promise.all(
                response.results.map((item) => item.data()),
            );
        } else if (import.meta.env.DEV) {
            searchResults = fakeResult;
        } else {
            searchResults = [];
            console.error("Pagefind is not available in production environment.");
        }
        result = searchResults;
        setPanelVisibility(result.length > 0, isDesktop);
    } catch (error) {
        console.error("Search error:", error);
        result = [];
        setPanelVisibility(false, isDesktop);
    } finally {
        isSearching = false;
    }
};

const handleClickOutside = (event: MouseEvent) => {
    const panel = document.getElementById("search-panel");
    if (!panel || panel.classList.contains("float-panel-closed")) {
        return;
    }
    onClickOutside(event, "search-panel", ["search-switch", "search-bar"], () => {
        closeSearchPanel();
        isDesktopSearchExpanded = false;
    });
};

onMount(() => {
    document.addEventListener("click", handleClickOutside);
    const initializeSearch = () => {
        initialized = true;
        pagefindLoaded =
            typeof window !== "undefined" &&
            !!window.pagefind &&
            typeof window.pagefind.search === "function";
        console.log("Pagefind status on init:", pagefindLoaded);
    };
    if (import.meta.env.DEV) {
        console.log(
            "Pagefind is not available in development mode. Using mock data.",
        );
        initializeSearch();
    } else {
        document.addEventListener("pagefindready", () => {
            console.log("Pagefind ready event received.");
            initializeSearch();
        });
        document.addEventListener("pagefindloaderror", () => {
            console.warn(
                "Pagefind load error event received. Search functionality will be limited.",
            );
            initializeSearch();
        });
        setTimeout(() => {
            if (!initialized) {
                console.log("Fallback: Initializing search after timeout.");
                initializeSearch();
            }
        }, 2000);
    }
});

$effect(() => {
    if (initialized) {
        const keyword = keywordDesktop || keywordMobile;
        const isDesktop = !!keywordDesktop || isDesktopSearchExpanded;
        
        clearTimeout(debounceTimer);
        if (keyword) {
            debounceTimer = setTimeout(() => {
                search(keyword, isDesktop);
            }, 300);
        } else {
            result = [];
            setPanelVisibility(false, isDesktop);
        }
    }
});

$effect(() => {
    if (typeof document !== 'undefined') {
        const navbar = document.getElementById('navbar');
        if (isDesktopSearchExpanded) {
            navbar?.classList.add('is-searching');
        } else {
            navbar?.classList.remove('is-searching');
        }
    }
});

onDestroy(() => {
    if (typeof document !== 'undefined') {
        document.removeEventListener("click", handleClickOutside);
        const navbar = document.getElementById('navbar');
        navbar?.classList.remove('is-searching');
    }
    clearTimeout(debounceTimer);
});
</script>

<div class="relative h-full flex items-center">
    <!-- search bar for desktop view (collapsed by default) -->
    <div
        id="search-bar"
        class="hidden lg:flex relative transition-all duration-300 origin-right items-center h-11 rounded-full
            {isDesktopSearchExpanded ? 'bg-black/4 hover:bg-black/6 focus-within:bg-black/6 dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10 w-52' : 'btn-plain scale-animation active:scale-90 w-11'}"
        role="button"
        tabindex="0"
        aria-label="Search"
        onclick={() => { if (!isDesktopSearchExpanded) toggleDesktopSearch(); document.getElementById('search-input-desktop')?.focus(); }}
        onmouseenter={() => {if (!isDesktopSearchExpanded) toggleDesktopSearch()}}
        onmouseleave={collapseDesktopSearch}
    >
        <Icon icon="material-symbols:search" class="absolute text-[1.25rem] pointer-events-none {isDesktopSearchExpanded ? 'left-3' : 'left-1/2 -translate-x-1/2'} transition-all my-auto {isDesktopSearchExpanded ? 'text-black/40 dark:text-white/40' : ''}"></Icon>
        <input id="search-input-desktop" placeholder="{i18n(I18nKey.search)}" bind:value={keywordDesktop}
            onfocus={() => {if (!isDesktopSearchExpanded) toggleDesktopSearch(); search(keywordDesktop, true)}}
            onblur={handleBlur}
            class="transition-all duration-300 pl-10 pr-8 text-sm bg-transparent outline-0
                h-full {isDesktopSearchExpanded ? 'w-full opacity-100' : 'w-0 opacity-0'} text-black/75 dark:text-white/75"
        >
        {#if isDesktopSearchExpanded && keywordDesktop}
            <button
                type="button"
                onmousedown={(e) => { e.preventDefault(); keywordDesktop = ""; result = []; setPanelVisibility(false, true); }}
                class="absolute right-2.5 p-0.5 text-black/30 hover:text-black/60 dark:text-white/30 dark:hover:text-white/60 transition-colors"
                aria-label="Clear"
            >
                <Icon icon="material-symbols:close-rounded" class="text-sm" />
            </button>
        {/if}
    </div>

    <!-- toggle btn for phone/tablet view -->
    <button onclick={togglePanel} aria-label="Search Panel" id="search-switch"
            class="btn-plain scale-animation lg:hidden! rounded-full w-11 h-11 active:scale-90 flex items-center justify-center">
        <Icon icon="material-symbols:search" class="text-[1.25rem]"></Icon>
    </button>

    <!-- search panel: Responsive anchored right on both mobile and desktop -->
    <DropdownPanel
        id="search-panel"
        class="float-panel-closed absolute !top-[calc(100%+8px)] -right-[7px] sm:!right-0 w-[calc(100vw-1.5rem)] sm:w-[24rem] md:w-120 max-w-[calc(100vw-1.5rem)] md:max-w-none z-50 pointer-events-auto search-panel p-3.5 shadow-2xl transition-all duration-200 max-h-[calc(100vh-5.5rem)] overflow-y-auto overflow-x-hidden rounded-2xl"
    >
        <!-- search bar inside panel for phone/tablet -->
        <div class="flex items-center gap-2 lg:hidden w-full mb-2">
            <div id="search-bar-inside" class="flex relative flex-1 items-center h-10 rounded-full
                bg-black/5 hover:bg-black/8 focus-within:bg-black/8
                dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
            ">
                <Icon icon="material-symbols:search" class="absolute left-3 text-lg pointer-events-none my-auto text-black/30 dark:text-white/30"></Icon>
                <input placeholder="{i18n(I18nKey.search)}" bind:value={keywordMobile}
                       class="w-full h-10 pl-9 pr-8 text-sm bg-transparent outline-0
                       text-black/75 dark:text-white/75 placeholder:text-black/40 dark:placeholder:text-white/40"
                >
                {#if keywordMobile}
                    <button
                        type="button"
                        onclick={() => { keywordMobile = ""; result = []; }}
                        class="absolute right-2.5 p-1 text-black/30 hover:text-black/60 dark:text-white/30 dark:hover:text-white/60 transition-colors"
                        aria-label="Clear"
                    >
                        <Icon icon="material-symbols:close-rounded" class="text-base" />
                    </button>
                {/if}
            </div>
            <button
                type="button"
                onclick={closeSearchPanel}
                class="btn-plain scale-animation rounded-full h-9 px-3 text-xs shrink-0 text-neutral-600 dark:text-neutral-300 hover:text-(--primary)"
            >
                取消
            </button>
        </div>

        <!-- Search Status / Guidance -->
        {#if isSearching}
            <div class="py-8 flex flex-col items-center justify-center text-black/40 dark:text-white/40 gap-2">
                <Icon icon="eos-icons:loading" class="text-2xl" />
                <span class="text-xs">正在搜索...</span>
            </div>
        {:else if (keywordDesktop || keywordMobile) && result.length === 0}
            <div class="py-8 flex flex-col items-center justify-center text-black/40 dark:text-white/40 gap-1.5">
                <Icon icon="material-symbols:search-off-rounded" class="text-3xl opacity-60" />
                <span class="text-sm font-medium">未找到相关结果</span>
                <span class="text-xs opacity-75">尝试更换其他关键词搜索</span>
            </div>
        {:else if !(keywordDesktop || keywordMobile)}
            <div class="py-6 px-3 flex flex-col items-center justify-center text-center text-black/40 dark:text-white/40 gap-1.5">
                <Icon icon="material-symbols:manage-search-rounded" class="text-3xl opacity-60 text-(--primary)" />
                <span class="text-sm font-medium text-neutral-600 dark:text-neutral-300">输入关键词开始搜索</span>
                <span class="text-xs opacity-75">支持搜索全站文章标题、标签与正文内容</span>
            </div>
        {/if}

        <!-- search results -->
        {#if result.length > 0}
            <div class="search-results-list max-h-[calc(100vh-14rem)] overflow-y-auto mt-2 flex flex-col gap-1 pr-0.5 custom-scrollbar">
                {#each result as item}
                    <a href={item.url}
                       onclick={(e) => handleResultClick(e, item.url)}
                       class="transition group block rounded-xl text-base px-3 py-2.5 hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active)">
                        <div class="transition text-90 inline-flex font-bold group-hover:text-(--primary) items-center gap-1">
                            <span>{item.meta.title}</span>
                            <Icon icon="fa6-solid:chevron-right" class="transition text-[0.7rem] translate-x-0 group-hover:translate-x-1 my-auto text-(--primary)" />
                        </div>
                        {#if item.excerpt}
                            <div class="transition text-xs text-50 line-clamp-2 mt-0.5 leading-relaxed">
                                {@html item.excerpt}
                            </div>
                        {/if}
                    </a>
                {/each}
            </div>
        {/if}
    </DropdownPanel>
</div>

<style>
    input:focus {
        outline: 0;
    }
    :global(.search-panel) {
        max-height: calc(85vh - 70px);
        overflow-y: auto;
    }
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.15);
        border-radius: 9999px;
    }
    :global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
    }
</style>
