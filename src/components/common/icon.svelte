<script lang="ts">
/**
 * Svelte 图标组件 - 构建时内联 SVG + API 回退
 */
import { onMount } from "svelte";
import { getIconSvg, hasIcon } from "@utils/icons";


interface Props {
    icon: string;
    class?: string;
    style?: string;
    size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
    color?: string;
}

let {
    icon,
    class: className = "",
    style = "",
    size = "md",
    color,
}: Props = $props();

// 尺寸映射
const sizeClasses: Record<string, string> = {
    xs: "text-xs",
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
    xl: "text-xl",
    "2xl": "text-2xl",
};

const sizeClass = $derived(sizeClasses[size] || sizeClasses.md);
const colorStyle = $derived(color ? `color: ${color};` : "");
const combinedStyle = $derived(`${colorStyle}${style}`);
const combinedClass = $derived(`${sizeClass} ${className}`.trim());

// 获取内联 SVG
const svgContent = $derived(getIconSvg(icon));
const iconExists = $derived(hasIcon(icon));

let remoteSvg = $state("");

onMount(() => {
    if (!iconExists) {
        const [collection, name] = icon.split(":");
        if (collection && name) {
            fetch(`https://api.iconify.design/${collection}/${name}.svg?height=1em`)
                .then(r => r.ok ? r.text() : Promise.reject())
                .then(svg => { remoteSvg = svg; })
                .catch(() => {
                    if (window.__iconifyLoader) {
                        window.__iconifyLoader.load().catch(() => {});
                    }
                });
        }
    }
});
</script>

{#if iconExists && svgContent}
    <span
        class="inline-icon inline-flex items-center justify-center {combinedClass}"
        style={combinedStyle}
        aria-hidden="true"
    >
        {@html svgContent}
    </span>
{:else if remoteSvg}
    <span
        class="inline-icon inline-flex items-center justify-center {combinedClass}"
        style={combinedStyle}
        aria-hidden="true"
    >
        {@html remoteSvg}
    </span>
{:else}
    <span
        class="inline-icon inline-flex items-center justify-center {combinedClass}"
        style={combinedStyle}
        aria-hidden="true"
    >
        <iconify-icon icon={icon}></iconify-icon>
    </span>
{/if}

<style>
    .inline-icon :global(svg) {
        width: 1em;
        height: 1em;
        display: inline-block;
        vertical-align: middle;
        fill: currentColor;
    }
</style>