import { withAuth } from "next-auth/middleware";

/** Закрывает разделы без сессии до рендера страниц (§7.1). */
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/admin/:path*", "/m/:path*"],
};
