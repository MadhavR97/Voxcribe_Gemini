import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
    let res = NextResponse.next();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return req.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    res.cookies.set({ name, value, ...options });
                },
                remove(name: string, options: any) {
                    res.cookies.set({ name, value: "", ...options });
                },
            },
        }
    );

    const { data } = await supabase.auth.getUser();

    const protectedRoutes = ["/dashboard", "/transcription"];

    const isProtected = protectedRoutes.some((route) =>
        req.nextUrl.pathname.startsWith(route)
    );

    if (isProtected && !data.user) {
        return NextResponse.redirect(new URL("auth/login", req.url));
    }

    return res;
}

export const config = {
    matcher: ["/dashboard/:path*", "/transcription/:path*"],
};
