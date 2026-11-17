"use client";

import { TRPCClientError } from "@trpc/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc-client";
import { DataTable } from "@/components/ui/data-table";

function errorText(error: unknown): string {
  if (error instanceof TRPCClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Неизвестная ошибка";
}

export function RoomsAdmin({ canManage }: { canManage: boolean }) {
  const t = useTranslations("rooms");
  const utils = trpc.useUtils();
  const roomsQuery = trpc.rooms.all.useQuery();
  const typesQuery = trpc.rooms.allTypes.useQuery();

  const createRoom = trpc.rooms.createRoom.useMutation();
  const updateRoom = trpc.rooms.updateRoom.useMutation();
  const setRoomActive = trpc.rooms.setRoomActive.useMutation();
  const deleteRoom = trpc.rooms.deleteRoom.useMutation();
  const createType = trpc.rooms.createType.useMutation();
  const updateType = trpc.rooms.updateType.useMutation();
  const setTypeActive = trpc.rooms.setTypeActive.useMutation();

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [floorFilter, setFloorFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [roomForm, setRoomForm] = useState({
    number: "",
    floorMode: "number" as "number" | "name",
    floor: "1",
    floorName: "",
    roomTypeId: "",
    newTypeName: "",
  });
  const [typeForm, setTypeForm] = useState({ code: "", name: "" });
  const [nameDraft, setNameDraft] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    number: "",
    floorMode: "number" as "number" | "name",
    floor: "",
    floorName: "",
    roomTypeId: "",
  });

  const rooms = roomsQuery.data ?? [];
  const types = typesQuery.data ?? [];
  const activeTypes = types.filter((type) => type.isActive);

  const floors = useMemo(
    () =>
      [...new Set(rooms.map((room) => room.floorLabel))].sort((a, b) => {
        const an = /^\d+$/.test(a) ? Number(a) : NaN;
        const bn = /^\d+$/.test(b) ? Number(b) : NaN;
        if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
        if (Number.isFinite(an)) return -1;
        if (Number.isFinite(bn)) return 1;
        return a.localeCompare(b, "ru");
      }),
    [rooms],
  );

  const visibleRooms = rooms.filter((room) => {
    if (floorFilter !== "all" && room.floorLabel !== floorFilter) return false;
    if (typeFilter !== "all" && room.roomTypeId !== typeFilter) return false;
    if (search && !room.number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function floorPayload(mode: "number" | "name", floor: string, floorName: string) {
    return mode === "number"
      ? { floor: Number(floor) }
      : { floorName: floorName.trim() };
  }

  function startEdit(room: (typeof rooms)[number]) {
    const numeric = room.floor !== null;
    setEditId(room.id);
    setEditDraft({
      number: room.number,
      floorMode: numeric ? "number" : "name",
      floor: numeric ? String(room.floor) : "",
      floorName: numeric ? "" : room.floorName ?? "",
      roomTypeId: room.roomTypeId,
    });
    setError(null);
    setNotice(null);
  }

  async function saveEdit() {
    if (!editId) return;
    await run(
      () =>
        updateRoom.mutateAsync({
          id: editId,
          number: editDraft.number.trim(),
          ...floorPayload(editDraft.floorMode, editDraft.floor, editDraft.floorName),
          roomTypeId: editDraft.roomTypeId,
        }),
      t("roomUpdated"),
    );
    setEditId(null);
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      await Promise.all([utils.rooms.all.invalidate(), utils.rooms.allTypes.invalidate()]);
    } catch (mutationError) {
      setError(errorText(mutationError));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("intro")}
          
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

      {canManage ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("addRoom")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const floor = floorPayload(roomForm.floorMode, roomForm.floor, roomForm.floorName);
                  await run(
                    () =>
                      createRoom.mutateAsync({
                        number: roomForm.number.trim(),
                        ...floor,
                        ...(roomForm.newTypeName.trim()
                          ? { newTypeName: roomForm.newTypeName.trim() }
                          : { roomTypeId: roomForm.roomTypeId || activeTypes[0]?.id || "" }),
                      }),
                    t("roomAdded"),
                  );
                  setRoomForm({
                    ...roomForm,
                    number: "",
                    floorName: "",
                    newTypeName: "",
                  });
                }}
              >
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">{t("number")}</span>
                  <Input
                    value={roomForm.number}
                    onChange={(event) => setRoomForm({ ...roomForm, number: event.target.value })}
                    required
                    className="w-28"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">{t("floor")}</span>
                  <select
                    value={roomForm.floorMode}
                    onChange={(event) =>
                      setRoomForm({
                        ...roomForm,
                        floorMode: event.target.value as "number" | "name",
                      })
                    }
                    className="h-10 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="number">{t("numberFloor")}</option>
                    <option value="name">{t("typeName")}</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    {roomForm.floorMode === "number" ? t("numberFloor") : t("floorName")}
                  </span>
                  {roomForm.floorMode === "number" ? (
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={roomForm.floor}
                      onChange={(event) => setRoomForm({ ...roomForm, floor: event.target.value })}
                      required
                      className="w-24"
                    />
                  ) : (
                    <Input
                      value={roomForm.floorName}
                      onChange={(event) =>
                        setRoomForm({ ...roomForm, floorName: event.target.value })
                      }
                      placeholder={t("floorPlaceholder")}
                      required
                      className="w-44"
                    />
                  )}
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">{t("type")}</span>
                  <select
                    value={roomForm.roomTypeId || activeTypes[0]?.id || ""}
                    onChange={(event) =>
                      setRoomForm({ ...roomForm, roomTypeId: event.target.value })
                    }
                    className="h-10 rounded-md border bg-background px-3"
                  >
                    {activeTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">{t("newType")}</span>
                  <Input
                    value={roomForm.newTypeName}
                    onChange={(event) =>
                      setRoomForm({ ...roomForm, newTypeName: event.target.value })
                    }
                    placeholder={t("newTypePlaceholder")}
                    className="w-40"
                  />
                </label>
                <Button
                  type="submit"
                  disabled={
                    createRoom.isPending ||
                    (activeTypes.length === 0 && !roomForm.newTypeName.trim())
                  }
                >
                  {t("add")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("addType")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await run(
                    () => createType.mutateAsync({ code: typeForm.code, name: typeForm.name }),
                    t("typeAdded"),
                  );
                  setTypeForm({ code: "", name: "" });
                }}
              >
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">{t("typeCode")}</span>
                  <Input
                    value={typeForm.code}
                    onChange={(event) => setTypeForm({ ...typeForm, code: event.target.value })}
                    placeholder="DELUXE"
                    required
                    className="w-32"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">{t("typeName")}</span>
                  <Input
                    value={typeForm.name}
                    onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })}
                    required
                  />
                </label>
                <Button type="submit" disabled={createType.isPending}>
                  {t("add")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          {t("viewOnly")}
        </p>
      )}

      {canManage ? (
        <Card>
        <CardHeader>
          <CardTitle>{t("types")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable minWidth="760px">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">{t("typeCode")}</th>
                <th className="py-2 font-medium">{t("typeName")}</th>
                <th className="py-2 font-medium">{t("status")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{type.code}</td>
                  <td className="py-2">
                    <Input
                      value={nameDraft[type.id] ?? type.name}
                      onChange={(event) =>
                        setNameDraft({ ...nameDraft, [type.id]: event.target.value })
                      }
                      className="h-9 w-48"
                    />
                  </td>
                  <td className="py-2">{type.isActive ? t("active") : t("inactive")}</td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          run(
                            () =>
                              updateType.mutateAsync({
                                id: type.id,
                                name: nameDraft[type.id] ?? type.name,
                              }),
                            t("typeRenamed"),
                          )
                        }
                      >
                        {t("save")}
                      </Button>
                      <Button
                        size="sm"
                        variant={type.isActive ? "outline" : "default"}
                        onClick={() =>
                          run(
                            () => setTypeActive.mutateAsync({ id: type.id, isActive: !type.isActive }),
                            type.isActive ? t("typeDisabled") : t("typeEnabled"),
                          )
                        }
                      >
                        {type.isActive ? t("disable") : t("enable")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardContent>
      </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("rooms")} ({visibleRooms.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("floor")}</span>
              <select
                value={floorFilter}
                onChange={(event) => setFloorFilter(event.target.value)}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="all">{t("all")}</option>
                {floors.map((floor) => (
                  <option key={floor} value={String(floor)}>
                    {floor}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("type")}</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="h-10 rounded-md border bg-background px-3"
              >
                <option value="all">{t("all")}</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">{t("search")}</span>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-32"
              />
            </label>
          </div>

          <DataTable minWidth="760px">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">{t("number")}</th>
                <th className="py-2 font-medium">{t("floor")}</th>
                <th className="py-2 font-medium">{t("type")}</th>
                <th className="py-2 font-medium">{t("status")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {visibleRooms.map((room) => {
                const editing = editId === room.id;
                return (
                  <tr key={room.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">
                      {editing ? (
                        <Input
                          value={editDraft.number}
                          onChange={(event) =>
                            setEditDraft({ ...editDraft, number: event.target.value })
                          }
                          className="h-9 w-24"
                        />
                      ) : (
                        room.number
                      )}
                    </td>
                    <td className="py-2">
                      {editing ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={editDraft.floorMode}
                            onChange={(event) =>
                              setEditDraft({
                                ...editDraft,
                                floorMode: event.target.value as "number" | "name",
                              })
                            }
                            className="h-9 rounded-md border bg-background px-1 text-xs"
                          >
                            <option value="number">{t("numberFloor")}</option>
                            <option value="name">{t("typeName")}</option>
                          </select>
                          {editDraft.floorMode === "number" ? (
                            <Input
                              type="number"
                              min={1}
                              max={99}
                              value={editDraft.floor}
                              onChange={(event) =>
                                setEditDraft({ ...editDraft, floor: event.target.value })
                              }
                              className="h-9 w-20"
                            />
                          ) : (
                            <Input
                              value={editDraft.floorName}
                              onChange={(event) =>
                                setEditDraft({ ...editDraft, floorName: event.target.value })
                              }
                              className="h-9 w-32"
                            />
                          )}
                        </div>
                      ) : (
                        room.floorLabel
                      )}
                    </td>
                    <td className="py-2">
                      {editing ? (
                        <select
                          value={editDraft.roomTypeId}
                          onChange={(event) =>
                            setEditDraft({ ...editDraft, roomTypeId: event.target.value })
                          }
                          className="h-9 rounded-md border bg-background px-2"
                        >
                          {types
                            .filter((type) => type.isActive || type.id === room.roomTypeId)
                            .map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name}
                              </option>
                            ))}
                        </select>
                      ) : (
                        room.roomTypeName
                      )}
                    </td>
                    <td className="py-2">{room.isActive ? t("active") : t("inactive")}</td>
                    <td className="py-2 text-right">
                      {canManage ? (
                        <div className="flex justify-end gap-2">
                          {editing ? (
                            <>
                              <Button size="sm" onClick={saveEdit} disabled={updateRoom.isPending}>
                                {t("save")}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                                {t("cancel")}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => startEdit(room)}>
                                {t("edit")}
                              </Button>
                              <Button
                                size="sm"
                                variant={room.isActive ? "outline" : "default"}
                                onClick={() =>
                                  run(
                                    () =>
                                      setRoomActive.mutateAsync({
                                        id: room.id,
                                        isActive: !room.isActive,
                                      }),
                                    room.isActive ? t("roomDeactivated") : t("roomActivated"),
                                  )
                                }
                              >
                                {room.isActive ? "Деактивировать" : "Активировать"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      t("deleteConfirm", { number: room.number }),
                                    )
                                  ) {
                                    return;
                                  }
                                  void run(
                                    () => deleteRoom.mutateAsync({ id: room.id }),
                                    t("roomDeleted"),
                                  );
                                }}
                              >
                                {t("delete")}
                              </Button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}
