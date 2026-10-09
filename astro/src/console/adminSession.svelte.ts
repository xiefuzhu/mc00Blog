/**
 * 管理后台会话状态机 (Svelte 5 响应式)
 *
 * 单密码门禁: 进入 /console/ 时输入管理密码, 由后端校验后签发 HMAC 会话令牌;
 * 之后所有写操作都携带该令牌。共享密钥不再具备写权限。
 *
 * 规范：绝对禁止输出任何 Emoji 表情符号
 */

import { adminApi } from "./api/client";
import { getAuthToken, setAuthToken } from "@/lib/backend";

class AdminSession {
    /** 当前会话令牌 (localStorage 中恢复) */
    token = $state<string | null>(null);
    /** 令牌是否已通过后端校验 */
    verified = $state(false);
    /** 是否正在与后端校验 (登录或恢复会话) */
    checking = $state(false);
    /** 是否已完成过一次恢复校验 (用于避免首屏闪现门禁) */
    initialized = $state(false);

    /** 派生: 是否已进入后台 */
    isAuthenticated = $derived(this.verified && this.token !== null);

    constructor() {
        const saved = getAuthToken();
        if (saved) this.token = saved;
    }

    /** 用管理密码登录, 成功则保存令牌并标记已校验 */
    async login(password: string): Promise<{ success: boolean; message?: string }> {
        const pwd = password.trim();
        if (!pwd) {
            return { success: false, message: "请输入管理密码" };
        }

        this.checking = true;
        try {
            const res = await adminApi.login(pwd);
            setAuthToken(res.token);
            this.token = res.token;
            this.verified = true;
            return { success: true };
        } catch (error) {
            this.verified = false;
            return { success: false, message: error instanceof Error ? error.message : "验证失败" };
        } finally {
            this.checking = false;
            this.initialized = true;
        }
    }

    /** 恢复会话: 用已保存的令牌向后端确认是否仍然有效 */
    async verify(): Promise<boolean> {
        if (!this.token) {
            this.verified = false;
            this.initialized = true;
            return false;
        }

        this.checking = true;
        try {
            await adminApi.session();
            this.verified = true;
            return true;
        } catch {
            this.verified = false;
            setAuthToken(null);
            this.token = null;
            return false;
        } finally {
            this.checking = false;
            this.initialized = true;
        }
    }

    /** 退出后台: 清除令牌与校验状态 */
    logout(): void {
        setAuthToken(null);
        this.token = null;
        this.verified = false;
    }
}

export const adminSession = new AdminSession();
