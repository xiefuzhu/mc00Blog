/**
 * 账号鉴权与 RBAC 权限状态机 (Svelte 5 响应式)
 * 规范：绝对禁止输出任何 Emoji 表情符号
 */

import type { User, Role, Permission, UserRole } from "./types";
import { DEFAULT_USERS, DEFAULT_ROLES } from "./mockData";
import { authApi } from "./api/client";
import { getAuthToken, setAuthToken } from "@/lib/backend";

const AUTH_STORAGE_KEY = "twilight_halo_auth_v2";
const AUTH_TOKEN_KEY = "twilight_halo_auth_token";

class AuthStore {
    // 响应式状态
    currentUser = $state<User | null>(null);
    authToken = $state<string | null>(null);
    users = $state<User[]>([]);
    roles = $state<Role[]>([]);
    isMenuOpen = $state<boolean>(false);
    isModalOpen = $state<boolean>(false); // 兼容旧接口
    activeModalTab = $state<string>("dashboard"); // 兼容旧接口

    // 派生属性
    user = $derived(this.currentUser);
    isLoggedIn = $derived(this.currentUser !== null && this.authToken !== null);
    currentRole = $derived.by(() => {
        if (!this.currentUser) return null;
        return this.roles.find((r) => r.id === this.currentUser?.role) || null;
    });

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage() {
        if (typeof window === "undefined") {
            this.roles = [...DEFAULT_ROLES];
            this.users = [...DEFAULT_USERS];
            this.currentUser = null;
            this.authToken = null;
            return;
        }

        try {
            const raw = localStorage.getItem(AUTH_STORAGE_KEY);
            const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);

            if (raw) {
                const parsed = JSON.parse(raw);
                this.roles = Array.isArray(parsed.roles) && parsed.roles.length > 0
                    ? parsed.roles
                    : [...DEFAULT_ROLES];
                this.users = Array.isArray(parsed.users) && parsed.users.length > 0
                    ? parsed.users
                    : [...DEFAULT_USERS];

                // 确保默认超管 admin 始终存在
                this.ensureDefaultAdmin();

                // 仅当存在有效 token 且找到对应用户时才保持登录态
                if (savedToken && parsed.currentUserId) {
                    const found = this.users.find((u) => u.id === parsed.currentUserId);
                    if (found) {
                        this.currentUser = found;
                        this.authToken = savedToken;
                    } else {
                        this.currentUser = null;
                        this.authToken = null;
                    }
                } else {
                    this.currentUser = null;
                    this.authToken = null;
                }
            } else {
                this.roles = [...DEFAULT_ROLES];
                this.users = [...DEFAULT_USERS];
                this.ensureDefaultAdmin();
                this.currentUser = null;
                this.authToken = null;
                this.saveToStorage();
            }
        } catch {
            this.roles = [...DEFAULT_ROLES];
            this.users = [...DEFAULT_USERS];
            this.currentUser = null;
            this.authToken = null;
        }
    }

    private ensureDefaultAdmin() {
        const adminUser = this.users.find((u) => u.username === "admin");
        if (!adminUser) {
            this.users.unshift({
                id: "u-admin",
                username: "admin",
                name: "Halo 管理员",
                displayName: "Halo 管理员",
                email: "admin@mc00blog.local",
                password: "admin",
                avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                role: "admin",
                bio: "系统超级管理员，负责全站配置与架构维护。",
                createdAt: "2026-01-01T00:00:00.000Z",
                status: "active",
            });
        } else {
            // 确保 admin 初始密码为 admin
            if (!adminUser.password) {
                adminUser.password = "admin";
            }
        }
    }

    private saveToStorage() {
        if (typeof window === "undefined") return;
        try {
            const payload = {
                roles: this.roles,
                users: this.users,
                currentUserId: this.currentUser?.id || null,
            };
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
            if (this.authToken) {
                localStorage.setItem(AUTH_TOKEN_KEY, this.authToken);
            } else {
                localStorage.removeItem(AUTH_TOKEN_KEY);
            }
        } catch (e) {
            console.error("保存鉴权数据到本地失败", e);
        }
    }

    /** 把后端返回的用户写入本地用户表并建立会话 */
    private applySession(
        profile: { id?: string; username: string; name?: string; email?: string; role?: string; avatar?: string; bio?: string },
        token: string,
    ): void {
        const existing = this.users.find((u) => u.username === profile.username);
        let user: User;
        if (existing) {
            user = {
                ...existing,
                name: profile.name || existing.name,
                displayName: profile.name || existing.displayName,
                email: profile.email || existing.email,
                role: (profile.role as UserRole) || existing.role,
                avatar: profile.avatar || existing.avatar,
                bio: profile.bio || existing.bio,
            };
            this.users = this.users.map((u) => (u.id === user.id ? user : u));
        } else {
            user = {
                id: profile.id || `u-${Date.now()}`,
                username: profile.username,
                name: profile.name || profile.username,
                displayName: profile.name || profile.username,
                email: profile.email || `${profile.username}@example.com`,
                role: (profile.role as UserRole) || "admin",
                avatar: profile.avatar || "",
                bio: profile.bio || "",
                status: "active",
                createdAt: new Date().toISOString(),
            };
            this.users = [...this.users, user];
        }
        this.currentUser = user;
        this.authToken = token;
        setAuthToken(token);
        this.saveToStorage();
    }

    // 正规登录逻辑 (只走后端; 后端不可达时明确报错)
    async login(username: string, password: string): Promise<{ success: boolean; message?: string }> {
        const uname = username.trim();
        const pwd = password.trim();

        if (!uname || !pwd) {
            return { success: false, message: "请输入用户名与密码" };
        }

        try {
            const res = await authApi.login(uname, pwd);
            this.applySession(res.user, res.token);
            return { success: true };
        } catch (error) {
            return { success: false, message: error instanceof Error ? error.message : "登录失败" };
        }
    }

    // 一键免密登入超级管理员 (由后端签发令牌)
    async quickLogin(): Promise<{ success: boolean; message?: string }> {
        try {
            const res = await authApi.quickLogin();
            this.applySession(res.user, res.token);
            return { success: true, message: "一键免密进入成功" };
        } catch (error) {
            return { success: false, message: error instanceof Error ? error.message : "一键免密进入失败" };
        }
    }

    // 正规注册逻辑 (只走后端)
    async register(params: {
        username: string;
        name?: string;
        email: string;
        password: string;
    }): Promise<{ success: boolean; message?: string }> {
        const uname = params.username.trim();
        const pwd = params.password.trim();
        const email = params.email.trim();

        if (!uname || !pwd || !email) {
            return { success: false, message: "用户名、邮箱与密码不能为空" };
        }
        if (pwd.length < 5) {
            return { success: false, message: "密码长度不得少于 5 位" };
        }

        try {
            const res = await authApi.register({ username: uname, name: params.name || uname, email, password: pwd });
            const existing = this.users.find((u) => u.username === uname);
            if (!existing) {
                this.users = [
                    ...this.users,
                    {
                        id: res.user.id || `u-${Date.now()}`,
                        username: uname,
                        name: params.name || uname,
                        displayName: params.name || uname,
                        email,
                        role: (res.user.role as UserRole) || "reader",
                        avatar: res.user.avatar || "",
                        status: "active",
                        createdAt: new Date().toISOString(),
                    },
                ];
                this.saveToStorage();
            }
            return { success: true, message: "注册成功，请使用新账号登录" };
        } catch (error) {
            return { success: false, message: error instanceof Error ? error.message : "注册失败" };
        }
    }

    // 真正退出登录
    async logout(): Promise<void> {
        this.currentUser = null;
        this.authToken = null;
        setAuthToken(null);
        this.saveToStorage();
    }

    // RBAC 权限判断
    can(permission: Permission): boolean {
        if (!this.currentUser) return false;
        const role = this.currentRole;
        if (!role) return false;
        if (role.permissions.includes("*")) return true;
        if (role.permissions.includes(permission)) return true;

        const [domain] = permission.split(":");
        if (domain && role.permissions.includes(`${domain}:*`)) {
            return true;
        }

        return false;
    }

    // 控制台访问门禁（核心门禁守卫）
    canAccessConsole(): boolean {
        if (!this.currentUser || !this.authToken) return false;
        const role = this.currentRole;
        if (!role) return false;
        return !role.disallowAccessConsole;
    }

    // 更新个人资料
    updateProfile(updates: Partial<User>) {
        if (!this.currentUser) return;
        const index = this.users.findIndex((u) => u.id === this.currentUser?.id);
        if (index === -1) return;

        this.users[index] = {
            ...this.users[index],
            ...updates,
        };
        this.currentUser = this.users[index];
        this.saveToStorage();
    }

    // 修改当前用户密码
    changePassword(oldPwd: string, newPwd: string): { success: boolean; message: string } {
        if (!this.currentUser) return { success: false, message: "未登录" };
        if (this.currentUser.password && this.currentUser.password !== oldPwd) {
            return { success: false, message: "原密码不正确" };
        }
        if (newPwd.length < 5) {
            return { success: false, message: "新密码长度不得少于 5 位" };
        }

        this.updateProfile({ password: newPwd });
        return { success: true, message: "密码修改成功" };
    }

    // 管理员：创建用户
    createUser(user: Omit<User, "id" | "createdAt">): User {
        const newUser: User = {
            ...user,
            id: `u-${Date.now()}`,
            createdAt: new Date().toISOString(),
            avatar: user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`,
            password: user.password || "123456",
        };
        this.users = [...this.users, newUser];
        this.saveToStorage();
        return newUser;
    }

    // 管理员：更新用户
    updateUser(id: string, updates: Partial<User>) {
        this.users = this.users.map((u) => (u.id === id ? { ...u, ...updates } : u));
        if (this.currentUser?.id === id) {
            this.currentUser = { ...this.currentUser, ...updates };
        }
        this.saveToStorage();
    }

    // 管理员：删除用户
    deleteUser(id: string) {
        if (id === "u-admin" || id === this.currentUser?.id) return;
        this.users = this.users.filter((u) => u.id !== id);
        this.saveToStorage();
    }

    // 前台弹窗与菜单状态控制
    toggleMenu() {
        this.isMenuOpen = !this.isMenuOpen;
    }

    closeMenu() {
        this.isMenuOpen = false;
    }

    openModal(tab: string = "dashboard") {
        this.activeModalTab = tab;
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
    }
}

export const authStore = new AuthStore();
