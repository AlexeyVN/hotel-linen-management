import fs from "node:fs/promises";
import { BRANDING_LOGO_PATH } from "@/lib/branding";

export const dynamic = "force-dynamic";

/** Публичный логотип (нужен на странице входа); при отсутствии — 404. */
export async function GET() {
  try {
    const data = await fs.readFile(BRANDING_LOGO_PATH);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Логотип не задан" }, { status: 404 });
  }
}
