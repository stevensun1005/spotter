CREATE TABLE `friend_profiles` (
	`owner` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`search_name` text NOT NULL,
	`closed` integer DEFAULT false NOT NULL,
	`discoverable` integer DEFAULT false NOT NULL,
	`recent_only` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `friend_profiles_discoverable` ON `friend_profiles` (`discoverable`,`search_name`);--> statement-breakpoint
CREATE TABLE `friend_requests` (
	`first_id` text NOT NULL,
	`second_id` text NOT NULL,
	`id` text NOT NULL,
	`sender` text NOT NULL,
	`receiver` text NOT NULL,
	`sender_name` text NOT NULL,
	`receiver_name` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`first_id`, `second_id`),
	CONSTRAINT "friend_requests_members" CHECK("friend_requests"."first_id" < "friend_requests"."second_id" AND ("friend_requests"."sender" = "friend_requests"."first_id" AND "friend_requests"."receiver" = "friend_requests"."second_id" OR "friend_requests"."sender" = "friend_requests"."second_id" AND "friend_requests"."receiver" = "friend_requests"."first_id"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_requests_id_unique` ON `friend_requests` (`id`);--> statement-breakpoint
CREATE INDEX `friend_requests_sender` ON `friend_requests` (`sender`);--> statement-breakpoint
CREATE INDEX `friend_requests_receiver` ON `friend_requests` (`receiver`);