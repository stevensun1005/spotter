CREATE TABLE `coaching_lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	`delta` integer NOT NULL,
	`note` text NOT NULL,
	`reverses` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `coaching_links`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "coaching_lessons_delta" CHECK("coaching_lessons"."delta" BETWEEN -1000 AND 1000 AND "coaching_lessons"."delta" != 0)
);
--> statement-breakpoint
CREATE INDEX `coaching_lessons_link` ON `coaching_lessons` (`link_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `coaching_lessons_reversal` ON `coaching_lessons` (`link_id`,`reverses`);