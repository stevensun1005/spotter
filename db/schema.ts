import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  id: text().primaryKey(),
  invite: text().notNull().unique(),
  owner: text().notNull(),
});

export const members = sqliteTable("members", {
  user: text().primaryKey(),
  room: text().notNull().references(() => rooms.id),
  name: text().notNull(),
}, (table) => [index("members_room").on(table.room)]);

export const entries = sqliteTable("entries", {
  owner: text().notNull(),
  id: text().notNull(),
  kind: text().notNull(),
  payload: text().notNull(),
  updated: text().notNull(),
}, (table) => [primaryKey({ columns: [table.owner, table.id] })]);
