import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

/**
 * NextAuth v4 выбирает режим по второму аргументу: если у него есть `params`,
 * это App Router (NextAuthRouteHandler), иначе — Pages API (req.query).
 * Поэтому контекст с params обязателен, иначе падение на req.query.nextauth.
 * Явные обёртки — обход расхождения типов Next 15 (nextauthjs/next-auth#12784).
 */
type NextAuthRouteContext = { params: Promise<{ nextauth: string[] }> };

export async function GET(request: NextRequest, context: NextAuthRouteContext) {
  return handler(request, context);
}

export async function POST(request: NextRequest, context: NextAuthRouteContext) {
  return handler(request, context);
}
