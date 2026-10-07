<script lang="ts">
import { onDestroy, onMount } from "svelte";

import { SYSTEM_MODE, DARK_MODE, LIGHT_MODE } from "@constants/style";
import { WALLPAPER_FULLSCREEN, WALLPAPER_NONE } from "@constants/layout";
import { getDefaultHue, getHue, setHue } from "@utils/hue";
import { getStoredTheme, setTheme } from "@utils/theme";
import { getStoredWallpaperMode, setWallpaperMode } from "@utils/wallpaper";
import { getSiteLanguage, setStoredLanguage } from "@utils/language";
import { getSupportedTranslateLanguages } from "@/i18n/language";
import { i18n } from "@i18n/translation";
import I18nKey from "@i18n/i18nKey";
import { onClickOutside } from "@utils/widget";
import { siteConfig } from "@/config";
import Icon from "@components/common/icon.svelte";
import type { LIGHT_DARK_MODE, WALLPAPER_MODE } from "@/types/config";

type AccordionSection = "theme" | "color" | "wallpaper" | "language" | null;

let isOpen = $state(false);
let expandedSection = $state<AccordionSection>(null);

// 材质模式
let glassMode = $state<"liquid" | "frosted">("liquid");

// 主题模式
let themeMode = $state<LIGHT_DARK_MODE>(siteConfig.defaultTheme || SYSTEM_MODE);

// 色相
let hue = $state(getDefaultHue());
const defaultHue = getDefaultHue();

// 壁纸模式
let wallpaperMode = $state<WALLPAPER_MODE>(siteConfig.wallpaper.mode || WALLPAPER_FULLSCREEN);

// 语言翻译
let currentLanguage = $state("");
const languages = getSupportedTranslateLanguages();

function togglePanel() {
    isOpen = !isOpen;
    if (!isOpen) {
        expandedSection = null;
    } else {
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 50);
    }
}

function closePanel() {
    isOpen = false;
    expandedSection = null;
}

function toggleSection(section: "theme" | "color" | "wallpaper" | "language") {
    expandedSection = expandedSection === section ? null : section;
}

function switchGlassMode(newMode: "liquid" | "frosted") {
    glassMode = newMode;
    if (typeof window !== "undefined" && typeof (window as any).setGlassMode === "function") {
        (window as any).setGlassMode(newMode);
    } else {
        localStorage.setItem("glass-mode", newMode);
        document.documentElement.setAttribute("data-glass-mode", newMode);
        window.dispatchEvent(new CustomEvent("glass-mode-changed", { detail: { mode: newMode } }));
    }
}

function switchTheme(newMode: LIGHT_DARK_MODE) {
    themeMode = newMode;
    setTheme(newMode);
}

function resetHue() {
    hue = getDefaultHue();
}

function switchWallpaper(newMode: WALLPAPER_MODE) {
    wallpaperMode = newMode;
    setWallpaperMode(newMode);
}

async function changeLanguage(languageCode: string) {
    try {
        if (!(window as any).translateScriptLoaded && typeof (window as any).loadTranslateScript === "function") {
            await (window as any).loadTranslateScript();
        }
        if (!(window as any).translate) {
            console.warn("translate.js is not loaded");
            return;
        }
        const translate = (window as any).translate;
        const localLang = translate.language.getLocal();
        translate.changeLanguage(languageCode);
        if (languageCode === localLang) {
            translate.reset();
        }
        setStoredLanguage(languageCode);
        currentLanguage = languageCode;
    } catch (error) {
        console.error("Failed to execute translation:", error);
    }
}

function handleClickOutside(event: MouseEvent) {
    if (!isOpen) return;
    onClickOutside(event, "settings-menu-panel", "settings-menu-switch", () => {
        closePanel();
    });
}

onMount(() => {
    // 材质
    if (typeof window !== "undefined" && typeof (window as any).getGlassMode === "function") {
        glassMode = (window as any).getGlassMode();
    } else if (typeof localStorage !== "undefined") {
        glassMode = (localStorage.getItem("glass-mode") as "liquid" | "frosted") || "liquid";
    }

    // 主题
    themeMode = getStoredTheme();

    // 色相
    hue = getHue();

    // 壁纸
    wallpaperMode = getStoredWallpaperMode();

    // 语言
    currentLanguage = getSiteLanguage();

    document.addEventListener("click", handleClickOutside);
    return () => {
        document.removeEventListener("click", handleClickOutside);
    };
});

onDestroy(() => {
    if (typeof document !== "undefined") {
        document.removeEventListener("click", handleClickOutside);
    }
});

$effect(() => {
    if (hue || hue === 0) {
        setHue(hue);
    }
});

// 获取当前语言名称
const currentLangName = $derived.by(() => {
    const found = languages.find((l) => l.code === currentLanguage);
    return found ? found.name : currentLanguage;
});

// 获取当前主题文本
const currentThemeLabel = $derived.by(() => {
    if (themeMode === LIGHT_MODE) return i18n(I18nKey.lightMode);
    if (themeMode === DARK_MODE) return i18n(I18nKey.darkMode);
    return i18n(I18nKey.systemMode);
});

// 获取当前壁纸模式文本
const currentWallpaperLabel = $derived.by(() => {
    if (wallpaperMode === WALLPAPER_FULLSCREEN) return i18n(I18nKey.wallpaperFullscreen);
    if (wallpaperMode === WALLPAPER_NONE) return i18n(I18nKey.wallpaperNone);
    return i18n(I18nKey.wallpaperBanner);
});
</script>

<div class="relative z-50 h-full flex items-center">
    <!-- 设置按钮 -->
    <button
        aria-label="Settings"
        class="btn-plain scale-animation rounded-full h-11 w-11 active:scale-90 flex items-center justify-center transition-colors"
        id="settings-menu-switch"
        onclick={togglePanel}
    >
        <div class="transition-transform duration-300 flex items-center justify-center" class:rotate-45={isOpen}>
            <Icon icon="material-symbols:settings-outline" class="text-[1.25rem]" />
        </div>
    </button>

    <!-- 下拉设置面板：紧贴顶栏下方4px，平滑展开动画与玻璃质感 -->
    <div
        id="settings-menu-wrapper"
        class="absolute top-[calc(100%+4px)] right-0 w-80 max-w-[calc(100vw-1.5rem)] transition-all duration-200 origin-top-right z-50 {isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-95 opacity-0 pointer-events-none'}"
    >
        <div id="settings-menu-panel" class="card-base float-panel liquid-glass p-3 w-full max-h-[calc(100vh-5rem)] overflow-y-auto overflow-x-hidden rounded-2xl shadow-xl">
            <!-- 材质模式切换 -->
            <div class="px-2 pt-1 pb-2">
                <div class="text-xs font-semibold text-(--primary) mb-2 flex items-center gap-1.5">
                    <Icon icon="material-symbols:blur-on" class="text-sm" />
                    <span>界面材质 / Material</span>
                </div>
                <div class="grid grid-cols-2 p-1 gap-1 bg-(--btn-regular-bg) rounded-full text-xs font-medium">
                    <button
                        type="button"
                        class="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full transition-all duration-200 {glassMode === 'liquid' ? 'bg-(--primary) text-white shadow-sm font-semibold' : 'text-neutral-700 dark:text-neutral-300 hover:text-(--primary)'}"
                        onclick={() => switchGlassMode('liquid')}
                    >
                        <Icon icon="material-symbols:water-drop-outline" class="text-sm" />
                        <span>液态玻璃</span>
                    </button>
                    <button
                        type="button"
                        class="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full transition-all duration-200 {glassMode === 'frosted' ? 'bg-(--primary) text-white shadow-sm font-semibold' : 'text-neutral-700 dark:text-neutral-300 hover:text-(--primary)'}"
                        onclick={() => switchGlassMode('frosted')}
                    >
                        <Icon icon="material-symbols:blur-on" class="text-sm" />
                        <span>毛玻璃</span>
                    </button>
                </div>
            </div>

            <div class="border-t border-black/5 dark:border-white/10 my-1"></div>

            <!-- 手风琴选项列表 -->
            <div class="flex flex-col gap-1 py-1">
                <!-- 1. 主题模式 -->
                <div>
                    <button
                        type="button"
                        class="w-full flex items-center justify-between px-3 py-2 rounded-full hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active) transition-colors text-left group"
                        onclick={() => toggleSection('theme')}
                    >
                        <div class="flex items-center gap-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-(--primary)">
                            <div class="w-7 h-7 rounded-full bg-(--btn-regular-bg) flex items-center justify-center text-(--btn-content)">
                                {#if themeMode === LIGHT_MODE}
                                    <Icon icon="material-symbols:wb-sunny-outline-rounded" class="text-base" />
                                {:else if themeMode === DARK_MODE}
                                    <Icon icon="material-symbols:dark-mode-outline-rounded" class="text-base" />
                                {:else}
                                    <Icon icon="material-symbols:radio-button-partial-outline" class="text-base" />
                                {/if}
                            </div>
                            <span>主题模式</span>
                        </div>
                        <div class="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                            <span>{currentThemeLabel}</span>
                            <div class="transition-transform duration-200 flex items-center justify-center" class:rotate-90={expandedSection === 'theme'}>
                                <Icon icon="material-symbols:chevron-right-rounded" class="text-base opacity-70" />
                            </div>
                        </div>
                    </button>

                    {#if expandedSection === 'theme'}
                        <div class="accordion-content bg-black/5 dark:bg-white/5 rounded-2xl p-1.5 my-1 flex flex-col gap-1 border border-black/5 dark:border-white/5">
                            <button
                                type="button"
                                class="w-full flex items-center justify-between px-3.5 py-2 rounded-xl transition-colors text-sm font-medium {themeMode === LIGHT_MODE ? 'bg-(--btn-plain-bg-hover) text-(--primary)' : 'hover:bg-(--btn-plain-bg-hover) text-neutral-800 dark:text-neutral-200'}"
                                onclick={() => switchTheme(LIGHT_MODE)}
                            >
                                <div class="flex items-center gap-2.5">
                                    <Icon icon="material-symbols:wb-sunny-outline-rounded" class="text-base" />
                                    <span>{i18n(I18nKey.lightMode)}</span>
                                </div>
                                {#if themeMode === LIGHT_MODE}
                                    <Icon icon="material-symbols:check-rounded" class="text-base text-(--primary)" />
                                {/if}
                            </button>
                            <button
                                type="button"
                                class="w-full flex items-center justify-between px-3.5 py-2 rounded-xl transition-colors text-sm font-medium {themeMode === DARK_MODE ? 'bg-(--btn-plain-bg-hover) text-(--primary)' : 'hover:bg-(--btn-plain-bg-hover) text-neutral-800 dark:text-neutral-200'}"
                                onclick={() => switchTheme(DARK_MODE)}
                            >
                                <div class="flex items-center gap-2.5">
                                    <Icon icon="material-symbols:dark-mode-outline-rounded" class="text-base" />
                                    <span>{i18n(I18nKey.darkMode)}</span>
                                </div>
                                {#if themeMode === DARK_MODE}
                                    <Icon icon="material-symbols:check-rounded" class="text-base text-(--primary)" />
                                {/if}
                            </button>
                            <button
                                type="button"
                                class="w-full flex items-center justify-between px-3.5 py-2 rounded-xl transition-colors text-sm font-medium {themeMode === SYSTEM_MODE ? 'bg-(--btn-plain-bg-hover) text-(--primary)' : 'hover:bg-(--btn-plain-bg-hover) text-neutral-800 dark:text-neutral-200'}"
                                onclick={() => switchTheme(SYSTEM_MODE)}
                            >
                                <div class="flex items-center gap-2.5">
                                    <Icon icon="material-symbols:radio-button-partial-outline" class="text-base" />
                                    <span>{i18n(I18nKey.systemMode)}</span>
                                </div>
                                {#if themeMode === SYSTEM_MODE}
                                    <Icon icon="material-symbols:check-rounded" class="text-base text-(--primary)" />
                                {/if}
                            </button>
                        </div>
                    {/if}
                </div>

                <!-- 2. 主题色彩 -->
                <div>
                    <button
                        type="button"
                        class="w-full flex items-center justify-between px-3 py-2 rounded-full hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active) transition-colors text-left group"
                        onclick={() => toggleSection('color')}
                    >
                        <div class="flex items-center gap-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-(--primary)">
                            <div class="w-7 h-7 rounded-full bg-(--btn-regular-bg) flex items-center justify-center text-(--btn-content)">
                                <Icon icon="material-symbols:palette-outline" class="text-base" />
                            </div>
                            <span>{i18n(I18nKey.themeColor)}</span>
                        </div>
                        <div class="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                            <span class="inline-block w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/20" style="background-color: var(--primary);"></span>
                            <span>{hue}</span>
                            <div class="transition-transform duration-200 flex items-center justify-center" class:rotate-90={expandedSection === 'color'}>
                                <Icon icon="material-symbols:chevron-right-rounded" class="text-base opacity-70" />
                            </div>
                        </div>
                    </button>

                    {#if expandedSection === 'color'}
                        <div class="accordion-content bg-black/5 dark:bg-white/5 rounded-2xl p-2.5 my-1 border border-black/5 dark:border-white/5">
                            <div class="flex flex-row gap-2 mb-2.5 items-center justify-between">
                                <div class="flex items-center gap-2 font-bold text-xs text-neutral-900 dark:text-neutral-100">
                                    <span>色相数值</span>
                                    <button
                                        aria-label="Reset to Default"
                                        class="btn-regular w-5 h-5 rounded-full active:scale-90 flex items-center justify-center transition-opacity"
                                        class:opacity-0={hue === defaultHue}
                                        class:pointer-events-none={hue === defaultHue}
                                        onclick={resetHue}
                                    >
                                        <Icon icon="fa6-solid:arrow-rotate-left" class="text-[0.65rem]" />
                                    </button>
                                </div>
                                <div class="bg-(--btn-regular-bg) px-2.5 py-0.5 rounded-full font-bold text-xs text-(--btn-content)">
                                    {hue}
                                </div>
                            </div>
                            <div class="w-full h-6 px-1 bg-[oklch(0.80_0.10_0)] dark:bg-[oklch(0.70_0.10_0)] rounded-full select-none flex items-center">
                                <input
                                    aria-label={i18n(I18nKey.themeColor)}
                                    type="range"
                                    min="0"
                                    max="360"
                                    bind:value={hue}
                                    class="slider w-full"
                                    id="colorSlider"
                                    step="5"
                                />
                            </div>
                        </div>
                    {/if}
                </div>

                <!-- 3. 壁纸模式 -->
                <div>
                    <button
                        type="button"
                        class="w-full flex items-center justify-between px-3 py-2 rounded-full hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active) transition-colors text-left group"
                        onclick={() => toggleSection('wallpaper')}
                    >
                        <div class="flex items-center gap-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-(--primary)">
                            <div class="w-7 h-7 rounded-full bg-(--btn-regular-bg) flex items-center justify-center text-(--btn-content)">
                                {#if wallpaperMode === WALLPAPER_FULLSCREEN}
                                    <Icon icon="material-symbols:wallpaper" class="text-base" />
                                {:else if wallpaperMode === WALLPAPER_NONE}
                                    <Icon icon="material-symbols:hide-image-outline" class="text-base" />
                                {:else}
                                    <Icon icon="material-symbols:image-outline" class="text-base" />
                                {/if}
                            </div>
                            <span>{i18n(I18nKey.wallpaperMode)}</span>
                        </div>
                        <div class="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                            <span>{currentWallpaperLabel}</span>
                            <div class="transition-transform duration-200 flex items-center justify-center" class:rotate-90={expandedSection === 'wallpaper'}>
                                <Icon icon="material-symbols:chevron-right-rounded" class="text-base opacity-70" />
                            </div>
                        </div>
                    </button>

                    {#if expandedSection === 'wallpaper'}
                        <div class="accordion-content bg-black/5 dark:bg-white/5 rounded-2xl p-1.5 my-1 flex flex-col gap-1 border border-black/5 dark:border-white/5">
                            <button
                                type="button"
                                class="w-full flex items-center justify-between px-3.5 py-2 rounded-xl transition-colors text-sm font-medium {wallpaperMode === WALLPAPER_FULLSCREEN ? 'bg-(--btn-plain-bg-hover) text-(--primary)' : 'hover:bg-(--btn-plain-bg-hover) text-neutral-800 dark:text-neutral-200'}"
                                onclick={() => switchWallpaper(WALLPAPER_FULLSCREEN)}
                            >
                                <div class="flex items-center gap-2.5">
                                    <Icon icon="material-symbols:wallpaper" class="text-base" />
                                    <span>{i18n(I18nKey.wallpaperFullscreen)}</span>
                                </div>
                                {#if wallpaperMode === WALLPAPER_FULLSCREEN}
                                    <Icon icon="material-symbols:check-rounded" class="text-base text-(--primary)" />
                                {/if}
                            </button>
                            <button
                                type="button"
                                class="w-full flex items-center justify-between px-3.5 py-2 rounded-xl transition-colors text-sm font-medium {wallpaperMode === WALLPAPER_NONE ? 'bg-(--btn-plain-bg-hover) text-(--primary)' : 'hover:bg-(--btn-plain-bg-hover) text-neutral-800 dark:text-neutral-200'}"
                                onclick={() => switchWallpaper(WALLPAPER_NONE)}
                            >
                                <div class="flex items-center gap-2.5">
                                    <Icon icon="material-symbols:hide-image-outline" class="text-base" />
                                    <span>{i18n(I18nKey.wallpaperNone)}</span>
                                </div>
                                {#if wallpaperMode === WALLPAPER_NONE}
                                    <Icon icon="material-symbols:check-rounded" class="text-base text-(--primary)" />
                                {/if}
                            </button>
                        </div>
                    {/if}
                </div>

                <!-- 4. 语言设置 -->
                {#if siteConfig.translate?.enable}
                    <div>
                        <button
                            type="button"
                            class="w-full flex items-center justify-between px-3 py-2 rounded-full hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active) transition-colors text-left group"
                            onclick={() => toggleSection('language')}
                        >
                            <div class="flex items-center gap-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-(--primary)">
                                <div class="w-7 h-7 rounded-full bg-(--btn-regular-bg) flex items-center justify-center text-(--btn-content)">
                                    <Icon icon="material-symbols:translate" class="text-base" />
                                </div>
                                <span>语言 / Language</span>
                            </div>
                            <div class="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                                <span>{currentLangName}</span>
                                <div class="transition-transform duration-200 flex items-center justify-center" class:rotate-90={expandedSection === 'language'}>
                                    <Icon icon="material-symbols:chevron-right-rounded" class="text-base opacity-70" />
                                </div>
                            </div>
                        </button>

                        {#if expandedSection === 'language'}
                            <div class="accordion-content bg-black/5 dark:bg-white/5 rounded-2xl p-1.5 my-1 flex flex-col gap-1 border border-black/5 dark:border-white/5 max-h-52 overflow-y-auto pr-1">
                                {#each languages as lang}
                                    <button
                                        type="button"
                                        class="w-full flex items-center justify-between px-3 py-1.5 rounded-xl transition-colors text-sm font-medium {currentLanguage === lang.code ? 'bg-(--btn-plain-bg-hover) text-(--primary)' : 'hover:bg-(--btn-plain-bg-hover) text-neutral-800 dark:text-neutral-200'}"
                                        onclick={() => changeLanguage(lang.code)}
                                    >
                                        <div class="flex items-center gap-2">
                                            <span class="text-base">{lang.icon}</span>
                                            <span>{lang.name}</span>
                                        </div>
                                        {#if currentLanguage === lang.code}
                                            <Icon icon="material-symbols:check-rounded" class="text-base text-(--primary)" />
                                        {/if}
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

<style lang="stylus">
    #settings-menu-panel
        input[type="range"]
            -webkit-appearance none
            height 1.5rem
            background-image var(--color-selection-bar)
            transition background-image var(--transition-duration-fast) ease-in-out
            border-radius 9999px

            /* Input Thumb */
            &::-webkit-slider-thumb
                -webkit-appearance none
                height 1rem
                width 0.5rem
                border-radius 9999px
                background rgba(255, 255, 255, 0.85)
                box-shadow 0 1px 3px rgba(0, 0, 0, 0.3)
                &:hover
                    background rgba(255, 255, 255, 1)
                &:active
                    background rgba(255, 255, 255, 0.7)

            &::-moz-range-thumb
                -webkit-appearance none
                height 1rem
                width 0.5rem
                border-radius 9999px
                border-width 0
                background rgba(255, 255, 255, 0.85)
                box-shadow 0 1px 3px rgba(0, 0, 0, 0.3)
                &:hover
                    background rgba(255, 255, 255, 1)
                &:active
                    background rgba(255, 255, 255, 0.7)

    :global(.accordion-content)
        animation accordionSlideDown 0.18s cubic-bezier(0.16, 1, 0.3, 1)

    @keyframes accordionSlideDown
        from
            opacity 0
            transform translateY(-4px)
        to
            opacity 1
            transform translateY(0)
</style>
