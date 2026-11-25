CREATE TABLE `buddy_requests` (
	`first_id` text NOT NULL,
	`second_id` text NOT NULL,
	`id` text NOT NULL,
	`sender` text NOT NULL,
	`receiver` text NOT NULL,
	`sender_name` text NOT NULL,
	`receiver_name` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`first_id`, `second_id`),
	FOREIGN KEY (`first_id`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`second_id`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "buddy_requests_members" CHECK("buddy_requests"."first_id" < "buddy_requests"."second_id"
    AND ("buddy_requests"."sender" = "buddy_requests"."first_id" AND "buddy_requests"."receiver" = "buddy_requests"."second_id"
      OR "buddy_requests"."sender" = "buddy_requests"."second_id" AND "buddy_requests"."receiver" = "buddy_requests"."first_id"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buddy_requests_id_unique` ON `buddy_requests` (`id`);--> statement-breakpoint
CREATE INDEX `buddy_requests_second` ON `buddy_requests` (`second_id`);--> statement-breakpoint
CREATE TABLE `spotter_account_handles` (
	`owner` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "spotter_handle_username" CHECK(length("spotter_account_handles"."username") BETWEEN 3 AND 24
    AND "spotter_account_handles"."username" NOT GLOB '*[^a-z0-9._]*'
    AND substr("spotter_account_handles"."username", 1, 1) GLOB '[a-z0-9]'
    AND substr("spotter_account_handles"."username", -1, 1) GLOB '[a-z0-9]'),
	CONSTRAINT "spotter_handle_tag" CHECK("spotter_account_handles"."tag" GLOB '[0-9][0-9][0-9][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spotter_account_handles_username_unique` ON `spotter_account_handles` (`username`);
--> statement-breakpoint
INSERT INTO `spotter_account_handles` (`owner`, `username`, `tag`)
SELECT `id`, 'spotter.' || lower(hex(randomblob(4))) || printf('%08x', row_number() OVER (ORDER BY `id`)),
  printf('%04d', (random() & 9223372036854775807) % 10000)
FROM `spotter_access_accounts`;
