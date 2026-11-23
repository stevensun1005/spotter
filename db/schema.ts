import { foreignKey, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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


export const friendLinks = sqliteTable("friend_links", {
  firstId: text("first_id").notNull(),
  secondId: text("second_id").notNull(),
  firstName: text("first_name").notNull(),
  secondName: text("second_name").notNull(),
  linked: integer({ mode: "boolean" }).notNull().default(false),
  firstTraining: integer("first_training", { mode: "boolean" }).notNull().default(false),
  firstNutrition: integer("first_nutrition", { mode: "boolean" }).notNull().default(false),
  secondTraining: integer("second_training", { mode: "boolean" }).notNull().default(false),
  secondNutrition: integer("second_nutrition", { mode: "boolean" }).notNull().default(false),
  // Null keeps the diet preference already saved before status and details were split.
  firstNutritionStatus: integer("first_nutrition_status", { mode: "boolean" }),
  secondNutritionStatus: integer("second_nutrition_status", { mode: "boolean" }),
}, (table) => [
  primaryKey({ columns: [table.firstId, table.secondId] }),
  index("friend_links_second").on(table.secondId),
]);

export const friendInvites = sqliteTable("friend_invites", {
  owner: text().primaryKey(),
  name: text().notNull(),
  code: text().notNull().unique(),
  expiresAt: text("expires_at").notNull(),
});
