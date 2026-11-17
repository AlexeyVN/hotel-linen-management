import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { PERMISSIONS, type PermissionCode, type SessionUser } from "@/lib/rbac";

const MAX_FAILED = 10;
const LOCK_MINUTES = 15;
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 10 * 60_000;

const knownPermissions = new Set<string>(PERMISSIONS);

/** Читает пользователя из БД и разворачивает права. Деактивированный → null. */
export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      rooms: true,
    },
  });
  if (!user || !user.isActive) return null;

  const permissions = user.role.permissions
    .map((rp) => rp.permission.code)
    .filter((code): code is PermissionCode => knownPermissions.has(code));

  return {
    id: user.id,
    login: user.login,
    fullName: user.fullName,
    roleCode: user.role.code,
    roleName: user.role.name,
    permissions,
    roomIds: user.rooms.map((r) => r.roomId),
  };
}

function clientIp(req: unknown): string {
  const headers = (req as { headers?: Record<string, string | string[] | undefined> })?.headers;
  if (!headers) return "unknown";
  const forwarded = headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof value === "string" && value.length > 0) return value.split(",")[0]!.trim();
  const real = headers["x-real-ip"];
  return typeof real === "string" ? real : "unknown";
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Логин и пароль",
      credentials: {
        login: { label: "Логин", type: "text" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials, req) {
        const login = String(credentials?.login ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!login || !password) return null;

        const ip = clientIp(req);
        if (!rateLimit(`login:${ip}:${login}`, LOGIN_LIMIT, LOGIN_WINDOW_MS).ok) {
          logger.warn({ login, ip }, "вход отклонён rate-limit");
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { login },
          include: { role: true },
        });

        if (!user) {
          // Выравниваем время ответа, чтобы не раскрывать существование логина.
          await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinv");
          return null;
        }

        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
          logger.warn({ login }, "вход отклонён: учётная запись заблокирована");
          return null;
        }

        const passwordOk = await bcrypt.compare(password, user.passwordHash);
        if (!passwordOk) {
          const failed = user.failedLogins + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLogins: failed,
              lockedUntil:
                failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
            },
          });
          logger.warn({ login, failed }, "неверный пароль");
          return null;
        }

        if (!user.isActive) {
          logger.warn({ login }, "вход отклонён: пользователь деактивирован");
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        logger.info({ login, role: user.role.code }, "успешный вход");

        return {
          id: user.id,
          name: user.fullName,
          login: user.login,
          roleCode: user.role.code,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.roleCode = (user as { roleCode?: string }).roleCode;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.uid ?? "");
        session.user.login = String((token as { login?: string }).login ?? "");
        session.user.roleCode = String(token.roleCode ?? "");
      }
      return session;
    },
  },
};

/**
 * Текущий пользователь с правами, свежими из БД.
 * Деактивация и смена роли действуют на следующем запросе (§7.1).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;
  return loadSessionUser(id);
}
