import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async () => {
    return new Response(
        JSON.stringify({
            success: true,
            message: "已安全退出登录",
        }),
        {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }
    );
};
