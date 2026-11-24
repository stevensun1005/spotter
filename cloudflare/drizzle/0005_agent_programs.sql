CREATE TABLE `agent_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`scopes` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_connections_token_hash_unique` ON `agent_connections` (`token_hash`);--> statement-breakpoint
CREATE INDEX `agent_connections_owner` ON `agent_connections` (`owner`,`created_at`);--> statement-breakpoint
CREATE TABLE `agent_draft_items` (
	`owner` text NOT NULL,
	`draft_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`was_added` integer NOT NULL,
	PRIMARY KEY(`owner`, `draft_id`, `plan_id`),
	FOREIGN KEY (`owner`,`draft_id`) REFERENCES `agent_plan_drafts`(`owner`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_plan_drafts` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`result` text,
	PRIMARY KEY(`owner`, `id`),
	CONSTRAINT "agent_plan_draft_status" CHECK("agent_plan_drafts"."status" IN ('draft', 'committed'))
);
--> statement-breakpoint
CREATE TABLE `agent_rate_windows` (
	`connection_id` text NOT NULL,
	`window` integer NOT NULL,
	`requests` integer NOT NULL,
	PRIMARY KEY(`connection_id`, `window`),
	FOREIGN KEY (`connection_id`) REFERENCES `agent_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `program_commits` (
	`owner` text NOT NULL,
	`program_id` text NOT NULL,
	`revision` text NOT NULL,
	`preview_token` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`owner`, `program_id`, `revision`, `preview_token`),
	FOREIGN KEY (`owner`,`program_id`) REFERENCES `training_programs`(`owner`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `program_plan_links` (
	`owner` text NOT NULL,
	`program_id` text NOT NULL,
	`session_id` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`owner`, `program_id`, `session_id`),
	FOREIGN KEY (`owner`,`program_id`) REFERENCES `training_programs`(`owner`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `program_rules` (
	`owner` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `training_programs` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`payload` text NOT NULL,
	`revision` text NOT NULL,
	`updated_at` text NOT NULL,
	`scheduled_at` text,
	`last_commit` text,
	PRIMARY KEY(`owner`, `id`)
);
