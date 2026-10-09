/**
 * 后端连通性状态 (Svelte 5 响应式)
 *
 * 控制台与前台组件据此决定是否显示账号信息、是否提示后端未连接。
 */

import { pingBackend, type BackendStatus } from "@/lib/backend";

class BackendStatusStore {
    online = $state(false);
    latency = $state(0);
    message = $state("检测中...");
    /** 是否已完成过一次探测 */
    checked = $state(false);
    /** 正在探测 */
    probing = $state(false);

    async refresh(): Promise<BackendStatus> {
        this.probing = true;
        try {
            const status = await pingBackend();
            this.online = status.online;
            this.latency = status.latency;
            this.message = status.message;
            this.checked = true;
            return status;
        } finally {
            this.probing = false;
        }
    }
}

export const backendStatusStore = new BackendStatusStore();

/** 应用启动后探测一次后端连通性 */
export function initBackendStatus(): void {
    void backendStatusStore.refresh();
}
