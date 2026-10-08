import type { APIRoute } from "astro";

export const prerender = false;

// 预设管理员凭据（满足用户要求：账号: admin，密码: admin）
const DEFAULT_ADMIN = {
    id: "u-admin",
    username: "admin",
    name: "Halo 管理员",
    email: "admin@mc00blog.local",
    role: "admin",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: "用户名和密码不能为空",
                }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        // 校验初始管理员凭据：账号 admin，密码 admin
        if (
            (username.trim().toLowerCase() === "admin" ||
                username.trim().toLowerCase() === "admin@mc00blog.local") &&
            password === "admin"
        ) {
            const token = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            return new Response(
                JSON.stringify({
                    success: true,
                    message: "登录成功",
                    token,
                    user: DEFAULT_ADMIN,
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        // 验证失败
        return new Response(
            JSON.stringify({
                success: false,
                message: "用户名或密码错误",
            }),
            {
                status: 401,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch {
        return new Response(
            JSON.stringify({
                success: false,
                message: "请求格式错误或解析异常",
            }),
            {
                status: 400,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
};
