CREATE TABLE `agent_template_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`connection_id` text NOT NULL,
	`template_id` text NOT NULL,
	`template_revision` text NOT NULL,
	`next_payload` text,
	`expires_at` text NOT NULL,
	`commit_key` text,
	`result` text,
	FOREIGN KEY (`connection_id`) REFERENCES `agent_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_template_changes_expiry` ON `agent_template_changes` (`connection_id`,`expires_at`);