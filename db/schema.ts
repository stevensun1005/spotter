import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const agentConnections = sqliteTable("agent_connections", {
  id: text().primaryKey().notNull(),
  owner: text().notNull(),
  name: text().notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  scopes: text().notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  lastUsedAt: text("last_used_at"),
  revokedAt: text("revoked_at"),
}, (table) => [index("agent_connections_owner").on(table.owner, table.createdAt)]);

export const agentRateWindows = sqliteTable("agent_rate_windows", {
  connectionId: text("connection_id").notNull().references(() => agentConnections.id, { onDelete: "cascade" }),
  window: integer().notNull(),
  requests: integer().notNull(),
}, (table) => [primaryKey({ columns: [table.connectionId, table.window] })]);

export const agentPlanDrafts = sqliteTable("agent_plan_drafts", {
  owner: text().notNull(),
  id: text().notNull(),
  title: text().notNull(),
  payload: text().notNull(),
  contentHash: text("content_hash").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  status: text().notNull().default("draft"),
  result: text(),
}, (table) => [
  primaryKey({ columns: [table.owner, table.id] }),
  check("agent_plan_draft_status", sql`${table.status} IN ('draft', 'committed')`),
]);

export const agentDraftItems = sqliteTable("agent_draft_items", {
  owner: text().notNull(),
  draftId: text("draft_id").notNull(),
  planId: text("plan_id").notNull(),
  wasAdded: integer("was_added").notNull(),
}, (table) => [
  primaryKey({ columns: [table.owner, table.draftId, table.planId] }),
  foreignKey({ columns: [table.owner, table.draftId], foreignColumns: [agentPlanDrafts.owner, agentPlanDrafts.id] }).onDelete("cascade"),
]);

export const trainingPrograms = sqliteTable("training_programs", {
  owner: text().notNull(),
  id: text().notNull(),
  payload: text().notNull(),
  revision: text().notNull(),
  updatedAt: text("updated_at").notNull(),
  scheduledAt: text("scheduled_at"),
  lastCommit: text("last_commit"),
}, (table) => [primaryKey({ columns: [table.owner, table.id] })]);

export const programRules = sqliteTable("program_rules", {
  owner: text().primaryKey().notNull(),
  payload: text().notNull(),
  revision: text().notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const programPlanLinks = sqliteTable("program_plan_links", {
  owner: text().notNull(),
  programId: text("program_id").notNull(),
  sessionId: text("session_id").notNull(),
  payload: text().notNull(),
}, (table) => [
  primaryKey({ columns: [table.owner, table.programId, table.sessionId] }),
  foreignKey({ columns: [table.owner, table.programId], foreignColumns: [trainingPrograms.owner, trainingPrograms.id] }).onDelete("cascade"),
]);

export const programCommits = sqliteTable("program_commits", {
  owner: text().notNull(),
  programId: text("program_id").notNull(),
  revision: text().notNull(),
  previewToken: text("preview_token").notNull(),
  payload: text().notNull(),
}, (table) => [
  primaryKey({ columns: [table.owner, table.programId, table.revision, table.previewToken] }),
  foreignKey({ columns: [table.owner, table.programId], foreignColumns: [trainingPrograms.owner, trainingPrograms.id] }).onDelete("cascade"),
]);
