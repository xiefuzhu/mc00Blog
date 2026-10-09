import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { username, name, email, password } = body;

        if (!username || !email || !password) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: "用户名、电子邮箱与密码均为必填项",
                }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        if (password.length < 5) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: "密码长度不得少于 5 位字符",
                }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        if (username.trim().toLowerCase() === "admin") {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: "该用户名已被系统保留，无法注册",
                }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const newUser = {
            id: `u-${Date.now()}`,
            username: username.trim(),
            name: name?.trim() || username.trim(),
            email: email.trim(),
            role: "reader", // 注册用户默认赋予读者身份
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username.trim())}`,
        };

        const token = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        return new Response(
            JSON.stringify({
                success: true,
                message: "注册成功，已赋予读者身份",
                token,
                user: newUser,
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch {
        return new Response(
            JSON.stringify({
                success: false,
                message: "请求解析失败",
            }),
            {
                status: 400,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
};
