import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { schema } from "./schema";

const processState = globalThis as typeof globalThis & { spotterDb?: DatabaseSync };

export function transaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function database() {
  if (processState.spotterDb) return processState.spotterDb;
  const destination = process.env.SPOTTER_DB_PATH;
  if (process.env.NODE_ENV === "production" && (!destination || !isAbsolute(destination))) {
    throw new Error("Production requires an absolute SPOTTER_DB_PATH on durable storage.");
  }
  const path = destination || resolve(".data/spotter.sqlite");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    transaction(db, () => {
      const { user_version: version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
      if (version > schema.length) throw new Error("The database requires a newer version of Spotter.");
      for (const migration of schema.slice(version)) db.exec(migration);
      db.exec("PRAGMA user_version = " + schema.length);
    });
    processState.spotterDb = db;
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
