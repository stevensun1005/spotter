CREATE TABLE `spotter_access_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`access_hash` text NOT NULL,
	CONSTRAINT "spotter_access_email_lowercase" CHECK(lower("spotter_access_accounts"."email") = "spotter_access_accounts"."email"),
	CONSTRAINT "spotter_access_hash_hex" CHECK(length("spotter_access_accounts"."access_hash") = 64 AND "spotter_access_accounts"."access_hash" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spotter_access_accounts_email_unique` ON `spotter_access_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `spotter_access_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `spotter_access_sessions_expiry` ON `spotter_access_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `spotter_access_sessions_account` ON `spotter_access_sessions` (`account_id`);