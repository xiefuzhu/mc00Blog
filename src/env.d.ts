/// <reference types="astro/client" />
/// <reference types="svelte" />
/// <reference path="../.astro/types.d.ts" />

declare module "*.svelte" {
    import type { Component } from "svelte";
    const component: Component<any, any, any>;
    export default component;
}
