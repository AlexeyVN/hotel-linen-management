import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      login: string;
      roleCode: string;
    } & DefaultSession["user"];
  }

  interface User {
    login?: string;
    roleCode?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    roleCode?: string;
    login?: string;
  }
}
