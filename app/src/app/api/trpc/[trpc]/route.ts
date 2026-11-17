import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { logger } from "@/lib/logger";
import { appRouter } from "@/server/trpc/root";
import { createContext } from "@/server/trpc/trpc";

const handler = (request: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      logger.error(
        { path, code: error.code, message: error.message },
        "ошибка tRPC",
      );
    },
  });

export { handler as GET, handler as POST };
