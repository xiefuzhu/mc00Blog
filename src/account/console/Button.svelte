<script lang="ts">
/**
 * 控制台统一按钮组件
 * 视觉规范见 src/styles/console.css：主要动作为主色实心胶囊，
 * 次要/图标/危险按钮沿用同一尺寸、圆角、字重与动效，仅替换配色。
 */
import type { Snippet } from "svelte";
import Icon from "@components/common/icon.svelte";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

interface Props {
    variant?: Variant;
    size?: Size;
    icon?: string;
    iconClass?: string;
    label?: string;
    href?: string;
    target?: string;
    disabled?: boolean;
    title?: string;
    type?: "button" | "submit";
    active?: boolean;
    block?: boolean;
    class?: string;
    children?: Snippet;
    onclick?: (event: MouseEvent) => void;
}

let {
    variant = "secondary",
    size = "sm",
    icon,
    iconClass = "",
    label,
    href,
    target,
    disabled = false,
    title,
    type = "button",
    active = false,
    block = false,
    class: className = "",
    children,
    onclick,
}: Props = $props();

const buttonClass = $derived(
    [
        "console-btn",
        `console-btn--${variant}`,
        `console-btn--${size}`,
        active ? "is-active" : "",
        block ? "console-btn--block" : "",
        className,
    ]
        .filter(Boolean)
        .join(" "),
);

const iconSizeClass = $derived(iconClass || (size === "lg" ? "text-lg" : "text-base"));
</script>

{#if href}
    <a
        {href}
        {target}
        class={buttonClass}
        {title}
        aria-disabled={disabled ? "true" : undefined}
        onclick={disabled ? (event: MouseEvent) => event.preventDefault() : onclick}
    >
        {#if icon}
            <Icon {icon} class={iconSizeClass} />
        {/if}
        {#if label}
            <span>{label}</span>
        {/if}
        {@render children?.()}
    </a>
{:else}
    <button {type} class={buttonClass} {title} {disabled} {onclick}>
        {#if icon}
            <Icon {icon} class={iconSizeClass} />
        {/if}
        {#if label}
            <span>{label}</span>
        {/if}
        {@render children?.()}
    </button>
{/if}
