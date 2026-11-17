"use client";

import { TRPCClientError } from "@trpc/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSION_LABELS } from "@/lib/permission-labels";
import type { PermissionCode } from "@/lib/rbac";
import { trpc } from "@/lib/trpc-client";

const ROLE_ORDER: Record<string, number> = { ADMIN: 0, MANAGER: 1, MAID: 2 };

export function RolesAdmin() {
  const utils = trpc.useUtils();
  const rolesQuery = trpc.roles.list.useQuery();
  const permissionsQuery = trpc.auth.permissions.useQuery();
  const updatePermissions = trpc.roles.updatePermissions.useMutation();

  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const roles = [...(rolesQuery.data ?? [])].sort(
    (a, b) => (ROLE_ORDER[a.code] ?? 99) - (ROLE_ORDER[b.code] ?? 99),
  );
  const permissions = permissionsQuery.data ?? [];

  async function save(roleId: string, codes: string[]) {
    setError(null);
    setNotice(null);
    try {
      await updatePermissions.mutateAsync({
        roleId,
        permissionCodes: codes as PermissionCode[],
      });
      setNotice("Права сохранены");
      await utils.roles.list.invalidate();
      await utils.auth.me.invalidate();
    } catch (mutationError) {
      setError(
        mutationError instanceof TRPCClientError
          ? mutationError.message
          : "Не удалось сохранить права",
      );
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Роли и права</h1>
        <p className="text-sm text-muted-foreground">
          Права проверяются на сервере при каждом запросе. У администратора нельзя
          снять управление пользователями и ролями — защита от самоблокировки.
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((role) => {
          const selected = draft[role.code] ?? role.permissionCodes;
          return (
            <Card key={role.id} data-role-code={role.code}>
              <CardHeader>
                <CardTitle>
                  {role.name} <span className="text-xs text-muted-foreground">({role.code})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {permissions.map((code) => {
                  const locked = role.code === "ADMIN" && (code === "users.manage" || code === "roles.manage");
                  const checked = selected.includes(code);
                  return (
                    <label key={code} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...selected, code]
                            : selected.filter((value) => value !== code);
                          setDraft({ ...draft, [role.code]: next });
                        }}
                      />
                      <span>{PERMISSION_LABELS[code] ?? code}</span>
                    </label>
                  );
                })}
                <Button className="mt-2" onClick={() => save(role.id, selected)}>
                  Сохранить «{role.name}»
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
