CREATE TABLE `friend_invites` (
	`owner` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_invites_code_unique` ON `friend_invites` (`code`);--> statement-breakpoint
CREATE TABLE `friend_links` (
	`first_id` text NOT NULL,
	`second_id` text NOT NULL,
	`first_name` text NOT NULL,
	`second_name` text NOT NULL,
	`linked` integer DEFAULT false NOT NULL,
	`first_training` integer DEFAULT false NOT NULL,
	`first_nutrition` integer DEFAULT false NOT NULL,
	`second_training` integer DEFAULT false NOT NULL,
	`second_nutrition` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`first_id`, `second_id`)
);
--> statement-breakpoint
CREATE INDEX `friend_links_second` ON `friend_links` (`second_id`);