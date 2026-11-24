CREATE TABLE `spotter_oauth_flows` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`account_id` text,
	`session_hash` text,
	`native` integer NOT NULL,
	`proof` text NOT NULL,
	`nonce` text NOT NULL,
	`pkce` text,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `spotter_oauth_flow_expiry` ON `spotter_oauth_flows` (`expires_at`);--> statement-breakpoint
CREATE TABLE `spotter_oauth_grants` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`state_hash` text NOT NULL,
	`provider` text NOT NULL,
	`account_id` text,
	`session_hash` text,
	`native` integer NOT NULL,
	`proof` text NOT NULL,
	`subject` text NOT NULL,
	`email` text,
	`display_name` text,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `spotter_oauth_grant_expiry` ON `spotter_oauth_grants` (`expires_at`);--> statement-breakpoint
CREATE TABLE `spotter_oauth_identities` (
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`account_id` text NOT NULL,
	PRIMARY KEY(`provider`, `subject`),
	FOREIGN KEY (`account_id`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "spotter_oauth_identity_provider" CHECK("spotter_oauth_identities"."provider" IN ('apple','google'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spotter_oauth_account_provider` ON `spotter_oauth_identities` (`account_id`,`provider`);