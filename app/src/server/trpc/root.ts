import { router } from "./trpc";
import { auditRouter } from "./routers/audit";
import { authRouter } from "./routers/auth";
import { catalogRouter } from "./routers/catalog";
import { checklistsRouter } from "./routers/checklists";
import { cleaningRouter } from "./routers/cleaning";
import { integrationRouter } from "./routers/integration";
import { itemsRouter } from "./routers/items";
import { operationsRouter } from "./routers/operations";
import { qrRouter } from "./routers/qr";
import { rolesRouter } from "./routers/roles";
import { roomsRouter } from "./routers/rooms";
import { settingsRouter } from "./routers/settings";
import { usersRouter } from "./routers/users";

export const appRouter = router({
  auth: authRouter,
  rooms: roomsRouter,
  items: itemsRouter,
  operations: operationsRouter,
  audit: auditRouter,
  cleaning: cleaningRouter,
  checklists: checklistsRouter,
  catalog: catalogRouter,
  settings: settingsRouter,
  integration: integrationRouter,
  qr: qrRouter,
  users: usersRouter,
  roles: rolesRouter,
});

export type AppRouter = typeof appRouter;
