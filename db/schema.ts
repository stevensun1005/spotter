import { foreignKey, index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const workoutHeart = sqliteTable("workout_heart", {
  owner: text().notNull(),
  workoutId: text("workout_id").notNull(),
  payload: text().notNull(),
}, (table) => [
  primaryKey({ columns: [table.owner, table.workoutId] }),
  foreignKey({ columns: [table.owner, table.workoutId], foreignColumns: [entries.owner, entries.id] }).onDelete("cascade"),
]);

export const personalLibrary = sqliteTable("personal_library", {
  owner: text().notNull(),
  kind: text().notNull(),
  id: text().notNull(),
  day: text(),
  payload: text().notNull(),
  updated: text().notNull(),
}, (table) => [
  primaryKey({ columns: [table.owner, table.kind, table.id] }),
  index("personal_library_day").on(table.owner, table.kind, table.day),
]);
