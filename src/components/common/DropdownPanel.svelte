<script lang="ts">
/**
 * 公共下拉面板组件 (Svelte 5 版本)
 * 用于壁纸切换、亮暗色切换等下拉面板
 */
import type { Snippet } from "svelte";


interface Props {
    class?: string;
    children?: Snippet;
    element?: HTMLElement;
}

let { class: className = "", children, element = $bindable(), ...restProps }: Props = $props();
</script>

<div bind:this={element} class={`card-base float-panel p-2 ${className}`.trim()} {...restProps}>
    {#if children}
        {@render children()}
    {/if}
</div>