CREATE TABLE `coaching_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`coach_id` text NOT NULL,
	`student_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`revision` text NOT NULL,
	`program_id` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`accepted_at` text,
	`result` text,
	`feedback` text,
	`feedback_at` text,
	FOREIGN KEY (`link_id`) REFERENCES `coaching_links`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "coaching_assignment_kind" CHECK("coaching_assignments"."kind" IN ('plan', 'program')),
	CONSTRAINT "coaching_assignment_status" CHECK("coaching_assignments"."status" IN ('pending', 'accepted', 'declined', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coaching_assignments_program_id_unique` ON `coaching_assignments` (`program_id`);--> statement-breakpoint
CREATE INDEX `coaching_assignments_coach` ON `coaching_assignments` (`coach_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `coaching_assignments_student` ON `coaching_assignments` (`student_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `coaching_invites` (
	`coach_id` text PRIMARY KEY NOT NULL,
	`coach_name` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`claimed_by` text,
	`claimed_at` text,
	`claim_nonce` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coaching_invites_code_hash_unique` ON `coaching_invites` (`code_hash`);--> statement-breakpoint
CREATE TABLE `coaching_links` (
	`id` text PRIMARY KEY NOT NULL,
	`coach_id` text NOT NULL,
	`coach_name` text NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`share_details` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`ended_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coaching_links_active_pair` ON `coaching_links` (`coach_id`,`student_id`) WHERE "coaching_links"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX `coaching_links_student` ON `coaching_links` (`student_id`,`created_at`);