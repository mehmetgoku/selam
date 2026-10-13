import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { applyOp, emptyState, sanitizeName, type Op, type OpCtx, type RoomState } from "@/lib/collab";

/**
 * Oda deposu (SQLite). Tek süreçli/tek sunuculu kurulum içindir; çok örnekli dağıtımda aynı arayüzü
 * Postgres/Redis gibi paylaşımlı bir depoyla değiştirin (tüm okuma-değiştirme-yazma `mutate` içinde).
 * Oda kimliği tahmin edilemez (72 bit) ve bir "bağlantı yetkisi"dir: bağlantıya sahip olan düzenleyebilir.
 */
const PRESENCE_TTL_MS = 30_000;
const ROOM_TTL_MS = 120 * 24 * 3600_000;
const MAX_LOG = 30;
const MAX_ROOMS_PER_HOUR = 500;

export interface LogEntry {
  t: number;
  by: string;
  text: string;
}
export interface RoomView {
  id: string;
  city: string;
  version: number;
  participants: { cid: string; name: string }[];
  /** istemci `since` ile aynı sürümdeyse yoktur (gereksiz yük taşınmaz) */
  state?: RoomState;
  log?: LogEntry[];
}

let _db: DatabaseSync | null = null;
function db() {
  if (_db) return _db;
  const file = process.env.SELAM_DB ?? path.join(process.cwd(), "data", "selam.db");
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  _db = new DatabaseSync(file);
  _db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY, city TEXT NOT NULL, state TEXT NOT NULL, version INTEGER NOT NULL,
      log TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS presence (
      room TEXT NOT NULL, cid TEXT NOT NULL, name TEXT NOT NULL, seen INTEGER NOT NULL,
      PRIMARY KEY (room, cid)
    );
  `);
  return _db;
}

/** Test için: bellek içi veritabanını sıfırlar. */
export function _resetForTests() {
  _db?.close();
  _db = null;
}

type Row = { id: string; city: string; state: string; version: number; log: string };

function view(row: Row, since?: number): RoomView {
  const d = db();
  const now = Date.now();
  d.prepare("DELETE FROM presence WHERE room = ? AND seen < ?").run(row.id, now - 10 * PRESENCE_TTL_MS);
  const participants = (
    d.prepare("SELECT cid, name FROM presence WHERE room = ? AND seen >= ? ORDER BY name, cid").all(row.id, now - PRESENCE_TTL_MS) as {
      cid: string;
      name: string;
    }[]
  ).map(({ cid, name }) => ({ cid, name }));
  const base = { id: row.id, city: row.city, version: row.version, participants };
  if (since === row.version) return base;
  return { ...base, state: JSON.parse(row.state) as RoomState, log: JSON.parse(row.log) as LogEntry[] };
}

function touch(id: string, cid: string, name: string) {
  db()
    .prepare(
      "INSERT INTO presence (room, cid, name, seen) VALUES (?, ?, ?, ?) ON CONFLICT(room, cid) DO UPDATE SET name = excluded.name, seen = excluded.seen",
    )
    .run(id, cid, sanitizeName(name), Date.now());
}

export function createRoom(city: string, state: RoomState = emptyState()): string | null {
  const d = db();
  const now = Date.now();
  d.prepare("DELETE FROM rooms WHERE updated < ?").run(now - ROOM_TTL_MS);
  const recent = d.prepare("SELECT COUNT(*) AS n FROM rooms WHERE created > ?").get(now - 3600_000) as { n: number };
  if (recent.n >= MAX_ROOMS_PER_HOUR) return null;
  const id = randomBytes(9).toString("base64url");
  d.prepare("INSERT INTO rooms (id, city, state, version, log, created, updated) VALUES (?, ?, ?, 0, '[]', ?, ?)").run(
    id,
    city,
    JSON.stringify(state),
    now,
    now,
  );
  return id;
}

export function getRoom(id: string, who?: { cid: string; name: string }, since?: number): RoomView | null {
  const row = db().prepare("SELECT id, city, state, version, log FROM rooms WHERE id = ?").get(id) as Row | undefined;
  if (!row) return null;
  if (who) touch(id, who.cid, who.name);
  return view(row, since);
}

export function roomCity(id: string): string | null {
  const r = db().prepare("SELECT city FROM rooms WHERE id = ?").get(id) as { city: string } | undefined;
  return r?.city ?? null;
}

export type MutateResult = { ok: true; room: RoomView } | { ok: false; error: string; status: number };

/** Okuma-uygulama-yazma tek bir IMMEDIATE işlemde: eşzamanlı istekler sırayla işlenir. */
export function mutateRoom(id: string, who: { cid: string; name: string }, op: Op, ctxBase: Omit<OpCtx, "cid" | "name">): MutateResult {
  const d = db();
  const name = sanitizeName(who.name);
  d.exec("BEGIN IMMEDIATE");
  try {
    const row = d.prepare("SELECT id, city, state, version, log FROM rooms WHERE id = ?").get(id) as Row | undefined;
    if (!row) {
      d.exec("ROLLBACK");
      return { ok: false, error: "Oda bulunamadı", status: 404 };
    }
    const before = JSON.parse(row.state) as RoomState;
    const res = applyOp(before, op, { ...ctxBase, cid: who.cid, name });
    if (!res.ok) {
      d.exec("ROLLBACK");
      return { ok: false, error: res.error, status: 422 };
    }
    let current: Row = row;
    if (res.summary && JSON.stringify(res.state) !== row.state) {
      const log = (JSON.parse(row.log) as LogEntry[]).concat({ t: Date.now(), by: name, text: res.summary }).slice(-MAX_LOG);
      current = { ...row, state: JSON.stringify(res.state), version: row.version + 1, log: JSON.stringify(log) };
      d.prepare("UPDATE rooms SET state = ?, version = ?, log = ?, updated = ? WHERE id = ?").run(
        current.state,
        current.version,
        current.log,
        Date.now(),
        id,
      );
    }
    touch(id, who.cid, name);
    d.exec("COMMIT");
    return { ok: true, room: view(current) };
  } catch (e) {
    try {
      d.exec("ROLLBACK");
    } catch {}
    throw e;
  }
}
