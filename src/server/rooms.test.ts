import { beforeEach, describe, expect, it } from "vitest";
import { emptyState } from "@/lib/collab";
import { _resetForTests, createRoom, getRoom, mutateRoom } from "./rooms";

process.env.SELAM_DB = ":memory:";
const ids = new Set(["ist-van", "ist-moda", "ist-galata"]);
const ctx = { validIds: ids, nameOf: (id: string) => id };
const ayse = { cid: "ayse-client-1", name: "Ayşe" };
const can = { cid: "can-client-001", name: "Can" };

beforeEach(() => _resetForTests());

describe("oda deposu", () => {
  it("oda aç, işlem uygula, sürüm artar ve etkinlik kaydı tutulur", () => {
    const id = createRoom("istanbul")!;
    expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
    const r = mutateRoom(id, ayse, { t: "add", placeId: "ist-van", day: 0 }, ctx);
    expect(r.ok && r.room.version).toBe(1);
    const room = getRoom(id)!;
    expect(room.state!.plan.days[0].stops).toHaveLength(1);
    expect(room.log).toEqual([expect.objectContaining({ by: "Ayşe", text: expect.stringContaining("ist-van") })]);
  });

  it("iki kullanıcının sıralı işlemleri birleşir; etkisiz işlem sürümü artırmaz", () => {
    const id = createRoom("istanbul")!;
    mutateRoom(id, ayse, { t: "add", placeId: "ist-van", day: 0 }, ctx);
    mutateRoom(id, can, { t: "add", placeId: "ist-moda", day: 0 }, ctx);
    const dup = mutateRoom(id, can, { t: "add", placeId: "ist-moda", day: 0 }, ctx);
    expect(dup.ok && dup.room.version).toBe(2);
    expect(getRoom(id)!.state!.plan.days[0].stops.map((s) => s.placeId)).toEqual(["ist-van", "ist-moda"]);
  });

  it("hatalı işlem durumu değiştirmez; olmayan oda 404", () => {
    const id = createRoom("istanbul")!;
    const bad = mutateRoom(id, ayse, { t: "vote", placeId: "ist-van" }, ctx); // planda değil
    expect(bad).toMatchObject({ ok: false, status: 422 });
    expect(getRoom(id)!.version).toBe(0);
    expect(mutateRoom("yokyokyokyok", ayse, { t: "addDay" }, ctx)).toMatchObject({ ok: false, status: 404 });
    expect(getRoom("yokyokyokyok")).toBeNull();
  });

  it("since aynıysa yük taşımaz; katılımcılar sunulur", () => {
    const id = createRoom("istanbul", emptyState())!;
    getRoom(id, ayse);
    getRoom(id, can);
    const same = getRoom(id, ayse, 0)!;
    expect(same.state).toBeUndefined();
    expect(same.participants.map((p) => p.name)).toEqual(["Ayşe", "Can"]);
    mutateRoom(id, ayse, { t: "addDay" }, ctx);
    expect(getRoom(id, ayse, 0)!.state).toBeDefined();
  });

  it("isim temizlenir (HTML/kontrol karakteri)", () => {
    const id = createRoom("istanbul")!;
    getRoom(id, { cid: "x-client-0001", name: "<img onerror=1>" });
    expect(getRoom(id)!.participants[0].name).not.toMatch(/[<>]/);
  });
});
