CREATE TABLE `personal_library` (
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`id` text NOT NULL,
	`day` text,
	`payload` text NOT NULL,
	`updated` text NOT NULL,
	PRIMARY KEY(`owner`, `kind`, `id`)
);
--> statement-breakpoint
CREATE INDEX `personal_library_day` ON `personal_library` (`owner`,`kind`,`day`);