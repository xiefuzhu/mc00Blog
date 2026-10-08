/**
 * 账号鉴权与 RBAC 权限状态机 (Svelte 5 响应式)
 * 规范：绝对禁止输出任何 Emoji 表情符号
 */

import type { User, Role, Permission } from "./types";
import { DEFAULT_USERS, DEFAULT_ROLES } from "./mockData";

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

    // 正规登录逻辑（优先 API 验证，本地兜底）
    async login(username: string, password: string): Promise<{ success: boolean; message?: string }> {
        const uname = username.trim().toLowerCase();
        const pwd = password.trim();

        if (!uname || !pwd) {
            return { success: false, message: "请输入用户名与密码" };
        }

        // 尝试调用服务端 API
        try {
            const res = await fetch("/api/auth/login/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: uname, password: pwd }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    const localUser = this.users.find((u) => u.username === data.user.username);
                    if (localUser) {
                        this.currentUser = localUser;
                    } else {
                        const fallbackUser: User = {
                            id: data.user.id || `u-${Date.now()}`,
                            username: data.user.username,
                            name: data.user.name || data.user.username,
                            email: data.user.email || `${data.user.username}@example.com`,
                            role: data.user.role || "admin",
                            avatar: data.user.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                            createdAt: new Date().toISOString(),
                        };
                        this.users.push(fallbackUser);
                        this.currentUser = fallbackUser;
                    }
                    this.authToken = data.token || `token_${Date.now()}`;
                    this.saveToStorage();
                    return { success: true };
                }
            }
        } catch {
            // 网络异常或静态无服务端环境，执行本地安全沙箱比对
        }

        // 本地环境核实
        this.ensureDefaultAdmin();
        const matched = this.users.find(
            (u) => (u.username.toLowerCase() === uname || u.email.toLowerCase() === uname)
        );

        if (matched) {
            // 特殊判断管理员默认密码 admin，或其他用户的密码
            const expectedPassword = matched.password || (matched.username === "admin" ? "admin" : "123456");
            if (pwd === expectedPassword) {
                this.currentUser = matched;
                this.authToken = `local_token_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                this.saveToStorage();
                return { success: true };
            }
        }

        return { success: false, message: "用户名或密码错误，请核对后重试" };
    }

    // 一键免密登入超级管理员 (零阻碍进入控制台工作台)
    async quickLogin(): Promise<{ success: boolean; message?: string }> {
        this.ensureDefaultAdmin();
        const adminUser = this.users.find((u) => u.username === "admin");
        if (adminUser) {
            this.currentUser = adminUser;
            this.authToken = `token_admin_quick_${Date.now()}`;
            this.saveToStorage();
            return { success: true, message: "一键免密进入成功" };
        }
        return { success: false, message: "未找到管理员预设凭证" };
    }

    // 正规注册逻辑
    async register(params: {
        username: string;
        name?: string;
        email: string;
        password: string;
    }): Promise<{ success: boolean; message?: string }> {
        const uname = params.username.trim().toLowerCase();
        const pwd = params.password.trim();
        const email = params.email.trim();

        if (!uname || !pwd || !email) {
            return { success: false, message: "用户名、邮箱与密码不能为空" };
        }

        if (pwd.length < 5) {
            return { success: false, message: "密码长度不得少于 5 位" };
        }

        if (uname === "admin") {
            return { success: false, message: "用户名 admin 为保留账号，不可注册" };
        }

        // 检查重名
        const exists = this.users.some(
            (u) => u.username.toLowerCase() === uname || u.email.toLowerCase() === email.toLowerCase()
        );
        if (exists) {
            return { success: false, message: "用户名或电子邮箱已存在" };
        }

        try {
            const res = await fetch("/api/auth/register/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: uname,
                    name: params.name || uname,
                    email,
                    password: pwd,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    const newUser: User = {
                        id: data.user.id || `u-${Date.now()}`,
                        username: uname,
                        name: params.name || uname,
                        email,
                        password: pwd,
                        role: "reader",
                        avatar: data.user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${uname}`,
                        createdAt: new Date().toISOString(),
                    };
                    this.users.push(newUser);
                    this.saveToStorage();
                    return { success: true, message: "注册成功，请使用新账号登录" };
                }
            }
        } catch {
            // 本地 fallback
        }

        // 本地写入
        const newUser: User = {
            id: `u-${Date.now()}`,
            username: uname,
            name: params.name || uname,
            email,
            password: pwd,
            role: "reader",
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${uname}`,
            createdAt: new Date().toISOString(),
        };
        this.users.push(newUser);
        this.saveToStorage();
        return { success: true, message: "注册成功，请使用新账号登录" };
    }

    // 真正退出登录
    async logout(): Promise<void> {
        try {
            await fetch("/api/auth/logout/", { method: "POST" });
        } catch {
            // ignore
        }
        this.currentUser = null;
        this.authToken = null;
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
