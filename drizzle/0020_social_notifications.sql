CREATE TABLE `notification_devices` (
	`installation_id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`session_hash` text NOT NULL,
	`token` text NOT NULL,
	`environment` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_hash`) REFERENCES `spotter_access_sessions`(`token_hash`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notification_device_environment" CHECK("notification_devices"."environment" IN ('production', 'development'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_devices_token_unique` ON `notification_devices` (`token`);--> statement-breakpoint
CREATE INDEX `notification_devices_owner_updated` ON `notification_devices` (`owner`,`updated_at`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`owner` text PRIMARY KEY NOT NULL,
	`buddy_reminders` integer DEFAULT true NOT NULL,
	`friend_workouts` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient` text NOT NULL,
	`actor` text NOT NULL,
	`kind` text NOT NULL,
	`reference` text NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`recipient`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notification_kind" CHECK("notifications"."kind" IN ('buddy-reminder', 'friend-workout')),
	CONSTRAINT "notification_distinct_people" CHECK("notifications"."recipient" <> "notifications"."actor")
);
--> statement-breakpoint
CREATE INDEX `notifications_recipient_created` ON `notifications` (`recipient`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_actor` ON `notifications` (`actor`);--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_friend_workout_once` ON `notifications` (`recipient`,`actor`,`reference`) WHERE "notifications"."kind" = 'friend-workout';