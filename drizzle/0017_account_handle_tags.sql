CREATE UNIQUE INDEX `spotter_account_handles_username_tag_unique` ON `spotter_account_handles` (`username`,`tag`);--> statement-breakpoint
DROP INDEX `spotter_account_handles_username_unique`;
