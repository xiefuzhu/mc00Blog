import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
        return new Response(
            JSON.stringify({
                authenticated: false,
                user: null,
            }),
            {
                status: 401,
                headers: { "Content-Type": "application/json" },
            }
        );
    }

    return new Response(
        JSON.stringify({
            authenticated: true,
            user: {
                id: "u-admin",
                username: "admin",
                name: "Halo 管理员",
                role: "admin",
            },
        }),
        {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }
    );
};
